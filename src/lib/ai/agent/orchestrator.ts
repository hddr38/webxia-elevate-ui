import { AgentConfig, createAgentConfig, validateLimits } from "./agent-limits";
import { buildAgentContext, truncateContext } from "./context-builder";
import { skillExecutor, SkillExecutor } from "../skills";
import { skillRegistry, getAllToolDefinitions } from "../skills";
import { eventBus } from "../events";
import { auditLogger } from "../security/audit-log";
import { hasContactInfo } from "./contact-detector";
import type { RAGEngine } from "../rag/rag-engine";
import {
  AgentContext,
  AgentLimits,
  AgentError,
  AgentErrorCode,
  ToolCall,
  ToolResult,
  ToolDefinition,
  ToolMessage,
  StreamEvent,
  TypedStreamEvent,
  ToolStartEvent,
  ToolResultEvent,
  CitationEvent,
  StreamChunk,
  Message,
  MessageRole,
  LLMProvider,
  ProviderRequest,
  ProviderResponse,
} from "../contracts";
import { ProviderError, ProviderErrorCode, isRetryableError } from "../providers";

export interface AuthContext {
  userId?: string;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export interface AgentDependencies {
  llmProvider: LLMProvider;
  ragEngine: RAGEngine;
  skillExecutor?: SkillExecutor;
  config?: Partial<AgentConfig>;
}

export interface AgentRunOptions {
  conversationId: string;
  sessionId: string;
  userId?: string;
  locale: string;
  requestId: string;
  userMessage: string;
  conversationHistory: Message[];
  stream?: boolean;
  /**
   * Receives every typed stream event. May return a promise: the orchestrator
   * awaits it before pulling the next provider chunk, which is how the chat
   * handler propagates HTTP backpressure all the way to the LLM connection.
   * Synchronous callbacks keep working unchanged.
   */
  onStream?: (event: TypedStreamEvent) => void | Promise<void>;
  onToolStart?: (event: ToolStartEvent) => void;
  onToolResult?: (event: ToolResultEvent) => void;
  onCitation?: (event: CitationEvent) => void;
  authContext?: AuthContext;
}

export interface AgentRunResult {
  finalResponse: string;
  messages: Message[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: "stop" | "length" | "tool_calls" | "error" | "abort";
  steps: number;
  toolCallCount: number;
  durationMs: number;
  errors: AgentError[];
}

/**
 * Why no final response was produced. Server-side diagnostics only —
 * carried in AgentError.details.cause, never exposed on the SSE wire
 * (StreamErrorEvent.data only has code/message/recoverable).
 */
export type GenerationFailureCause = AgentErrorCode | "EMPTY_RESPONSE";

export class AgentOrchestrator {
  private llmProvider: LLMProvider;
  private ragEngine: RAGEngine;
  private skillExecutor: SkillExecutor;
  private config: AgentConfig;
  private limits: AgentLimits;

  constructor(dependencies: AgentDependencies) {
    this.llmProvider = dependencies.llmProvider;
    this.ragEngine = dependencies.ragEngine;
    this.skillExecutor = dependencies.skillExecutor ?? skillExecutor;
    this.config = createAgentConfig(dependencies.config);
    this.limits = validateLimits(this.config.limits);
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const startTime = Date.now();
    const {
      conversationId,
      sessionId,
      userId,
      locale,
      requestId,
      userMessage,
      conversationHistory,
      stream = false,
      onStream,
      onToolStart,
      onToolResult,
      onCitation,
      authContext,
    } = options;

    const errors: AgentError[] = [];
    let steps = 0;
    let toolCallCount = 0;
    const messages: Message[] = [...conversationHistory];
    const toolCalls: ToolCall[] = [];
    const toolResults: ToolResult[] = [];
    // FIX F (LOT 38a bis): tools that already succeeded in this run are
    // stripped from every later provider request (deterministic one-shot
    // guard — the model cannot re-call what is no longer offered).
    const successfulToolNames = new Set<string>();
    // FIX G (LOT 38a bis): provider-facing feedback of the current run
    // (assistant tool-call turns + tool results). Deliberately kept out of
    // `messages`: only the final assistant answer is returned/persisted.
    const toolFeedback: Message[] = [];

    // Accumulated usage across all LLM calls
    const accumulatedUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    // Add user message to history
    const userMsg: Message = {
      id: `msg-${requestId}-user`,
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    };
    messages.push(userMsg);

    // No final response was (or can be) produced: fail loudly with a typed
    // error instead of replaying a previous assistant message as the answer.
    // The fixed message never carries history or provider bodies.
    const failGeneration: (cause: GenerationFailureCause) => never = (cause) => {
      const error = this.createAgentError(
        "GENERATION_FAILED",
        "LLM generation failed: no response produced",
        true,
        { cause, steps, toolCallCount },
      );
      const concise = `GENERATION_FAILED (cause=${cause})`;
      eventBus.emit("agent.error", requestId, { stage: "llm", message: concise });
      console.error(`[Webi] ${concise} (request ${requestId})`);
      throw error;
    };

    // Emit event
    eventBus.emit("agent.message.received", requestId, {
      sessionId,
      role: "user",
    });

    // Main agent loop
    while (steps < this.limits.maxAgentSteps) {
      steps++;

      // Check global timeout
      if (Date.now() - startTime > this.limits.globalTimeoutMs) {
        const timeoutError = this.createAgentError(
          "GLOBAL_TIMEOUT",
          `Agent loop exceeded global timeout of ${this.limits.globalTimeoutMs}ms`,
          false,
          { steps, toolCallCount },
        );
        errors.push(timeoutError);
        break;
      }

      // Build context (real history flows in; RAG/memory degrade gracefully)
      const contextResult = await buildAgentContext({
        conversationId,
        sessionId,
        userId,
        locale,
        requestId,
        userMessage,
        ragEngine: this.ragEngine,
        // FIX G: include this run's tool feedback so the model sees the
        // outcome of its tool calls on the next step.
        conversationHistory: [...messages, ...toolFeedback],
        maxHistoryMessages: 20,
        maxMemoryEntries: 10,
      });

      let agentContext = contextResult.agentContext;

      // Check context size
      if (!checkContextSize(agentContext, this.limits.maxContextTokens)) {
        agentContext = truncateContext(agentContext, this.limits.maxContextTokens);
      }

      // Emit context built event.
      eventBus.emit("agent.context.built", requestId, {
        sessionId,
        historyCount: messages.length,
        memoryCount: contextResult.memoryCount,
      });

      // Emit RAG citations (SSE stream). Identities come straight from
      // server retrieval: documentId/chunkId are never swapped or rebuilt.
      for (const doc of agentContext.rag.documents) {
        onCitation?.({
          type: "citation",
          data: {
            source: doc.source.url ?? doc.source.path ?? doc.title,
            excerpt: doc.content.slice(0, 200),
            relevance: doc.score,
            documentId: doc.documentId,
            chunkId: doc.chunkId,
            title: doc.title,
            chunkIndex: doc.chunkIndex,
          },
          timestamp: Date.now(),
          conversationId,
          requestId,
        });
      }

      // FIX F: drop tools that already succeeded in this run (no-op on the
      // first turn — the set is empty then).
      const toolsForThisTurn = (agentContext.availableTools ?? []).filter(
        (t) => !successfulToolNames.has(t.function.name),
      );
      if (successfulToolNames.size > 0) {
        console.log("[Webi] tools_excluded", [...successfulToolNames]);
      }

      // Prepare provider request
      const providerRequest: ProviderRequest = {
        model: this.config.defaultModel,
        messages: agentContext.messages,
        systemPrompt: agentContext.systemPrompt,
        // FIX F: omit the key entirely when every tool was already used —
        // an empty array plus tool_choice is not a shape all providers like.
        tools: toolsForThisTurn.length > 0 ? toolsForThisTurn : undefined,
        temperature: 0.7,
        maxTokens: 2000,
        stream,
      };

      // FIX K (LOT 38a quater): NIM can ignore save_lead even when the tool
      // is offered (H2' — logs showed finishReason:stop, toolCalls:0 while
      // contact was in the message). Deterministic fix: force tool_choice
      // for THIS turn only when contact is detected and save_lead is still
      // available. `saveLeadInTools` already excludes a save_lead that
      // succeeded (FIX F) -> no forced call on later turns, the model goes
      // back to "auto" to write its confirmation.
      const lastUserMessage = options.userMessage;
      const contactDetected = hasContactInfo(lastUserMessage);
      const saveLeadInTools = toolsForThisTurn.some((t) => t.function.name === "save_lead");
      const shouldForceSaveLead = contactDetected && saveLeadInTools;

      if (shouldForceSaveLead) {
        providerRequest.toolChoice = {
          type: "function",
          function: { name: "save_lead" },
        };
        console.log("[Webi] tool_choice_forced", {
          tool: "save_lead",
          reason: "contact detected in user message",
        });
      } else {
        providerRequest.toolChoice = "auto";
      }

      console.log(
        "[Webi] tools_sent",
        (providerRequest.tools ?? []).map((t) => t.function.name),
      );

      // Emit LLM started
      eventBus.emit("agent.llm.started", requestId, {
        model: this.config.defaultModel,
      });

      const llmStartTime = Date.now();

      try {
        let response: ProviderResponse;
        let reasoningChunks = 0;
        let ttftMs: number | null = null;
        let chunkCount = 0;

        if (stream && onStream) {
          const streamed = await this.streamLLM(
            providerRequest,
            onStream,
            conversationId,
            requestId,
          );
          response = streamed.response;
          reasoningChunks = streamed.reasoningChunks;
          ttftMs = streamed.ttftMs;
          chunkCount = streamed.chunkCount;
        } else {
          response = await this.llmProvider.complete(providerRequest);
        }

        // Accumulate usage
        accumulatedUsage.promptTokens += response.usage.promptTokens;
        accumulatedUsage.completionTokens += response.usage.completionTokens;
        accumulatedUsage.totalTokens += response.usage.totalTokens;

        const llmDuration = Date.now() - llmStartTime;

        // Emit LLM completed
        eventBus.emit("agent.llm.completed", requestId, {
          model: response.model,
          durationMs: llmDuration,
          reasoningChunks,
          ttftMs,
          chunkCount,
        });

        console.log("[Webi] llm_response", {
          finishReason: response.finishReason,
          toolCallsCount: response.toolCalls?.length ?? 0,
          hasContent: !!response.content,
        });

        // Handle response
        // FIX B (LOT 38a bis): gate on toolCalls presence, never on
        // finish_reason — some providers return tool_calls with another
        // finish_reason; a tool call must never be dropped silently.
        if (response.toolCalls && response.toolCalls.length > 0) {
          // Tool calls requested
          const toolResultsBefore = toolResults.length;
          let executedThisTurn = 0;
          let blockedThisTurn = 0;
          for (const toolCall of response.toolCalls) {
            if (toolCallCount >= this.limits.maxToolCalls) {
              const limitError = this.createAgentError(
                "MAX_TOOL_CALLS_EXCEEDED",
                `Maximum tool calls (${this.limits.maxToolCalls}) exceeded`,
                false,
                { toolCallCount },
              );
              errors.push(limitError);
              // FIX G: keep the assistant tool-call turn well-formed — every
              // tool_call in history must be answered by a tool message or
              // providers reject the request.
              toolFeedback.push({
                id: `msg-${requestId}-tool-${toolCall.id}`,
                role: "tool",
                content: JSON.stringify({
                  error: `Maximum tool calls (${this.limits.maxToolCalls}) exceeded`,
                }),
                timestamp: Date.now(),
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
              });
              break;
            }

            // FIX G1 (LOT 38a bis): the model can re-emit a tool name it saw
            // succeed in its own history even when the tool was removed from
            // the request — a tool that already succeeded in this run must
            // NEVER execute twice (duplicate leads, duplicated side effects).
            if (successfulToolNames.has(toolCall.function.name)) {
              blockedThisTurn++;
              toolResults.push({
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                content: JSON.stringify({
                  alreadyCompleted: true,
                  message:
                    "Cet outil a déjà réussi dans cette conversation — n'y reviens pas, rédige ta réponse finale.",
                }),
                success: true,
                metadata: { alreadyCompleted: true },
              });
              continue;
            }

            toolCallCount++;
            executedThisTurn++;
            toolCalls.push(toolCall);

            // Emit tool started (SSE stream)
            onToolStart?.({
              type: "tool_start",
              data: {
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
              timestamp: Date.now(),
              conversationId,
              requestId,
            });

            // Emit tool started (server event bus)
            eventBus.emit("agent.tool.started", requestId, {
              toolName: toolCall.function.name,
            });

            // Execute tool with auth context
            const toolStartTime = Date.now();

            // FIX C-bis (LOT 38a bis): malformed tool arguments must not
            // crash the step unobserved — audit + surface a recoverable
            // tool failure the model can correct on the next turn.
            let parsedArgs: Record<string, unknown>;
            try {
              parsedArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
            } catch (parseError) {
              const rawArguments = toolCall.function.arguments;
              const parseMessage =
                parseError instanceof Error ? parseError.message : "Invalid JSON";
              await auditLogger.logSecurityEvent("tool_execution_failure", {
                severity: "medium",
                userId,
                sessionId,
                conversationId,
                requestId,
                eventData: {
                  skill_name: toolCall.function.name,
                  error: `Invalid JSON in tool arguments: ${parseMessage}`,
                  received_args:
                    typeof rawArguments === "string"
                      ? rawArguments.slice(0, 500)
                      : String(rawArguments),
                },
                errorMessage: "Invalid JSON in tool arguments",
              });

              const invalidArgsResult: ToolResult = {
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                content: JSON.stringify({ error: "Invalid JSON in tool arguments" }),
                success: false,
                error: "Invalid JSON in tool arguments",
                metadata: { errorCode: "VALIDATION_ERROR", recoverable: true },
              };
              toolResults.push(invalidArgsResult);

              onToolResult?.({
                type: "tool_result",
                data: invalidArgsResult,
                timestamp: Date.now(),
                conversationId,
                requestId,
              });

              eventBus.emit("agent.tool.completed", requestId, {
                toolName: toolCall.function.name,
                durationMs: Date.now() - toolStartTime,
                success: false,
              });

              continue;
            }

            const executionResult = await this.skillExecutor.execute(
              toolCall.function.name,
              {
                conversationId,
                sessionId,
                userId,
                locale,
                requestId,
                metadata: authContext
                  ? { isAuthenticated: authContext.isAuthenticated, isAdmin: authContext.isAdmin }
                  : {},
              },
              parsedArgs,
            );

            const toolDuration = Date.now() - toolStartTime;

            const toolResult: ToolResult = {
              toolCallId: toolCall.id,
              toolName: toolCall.function.name,
              content: executionResult.result.content,
              success: executionResult.result.success,
              error: executionResult.result.error,
              metadata: executionResult.result.metadata,
            };

            toolResults.push(toolResult);

            // FIX F: remember the success so later turns stop offering it.
            if (executionResult.result.success) {
              successfulToolNames.add(toolCall.function.name);
            }

            // Emit tool result (SSE stream)
            onToolResult?.({
              type: "tool_result",
              data: toolResult,
              timestamp: Date.now(),
              conversationId,
              requestId,
            });

            // Emit tool completed (server event bus)
            eventBus.emit("agent.tool.completed", requestId, {
              toolName: toolCall.function.name,
              durationMs: toolDuration,
              success: toolResult.success,
            });

            // Emit citations from skill if present
            if (
              executionResult.skillResult.citations &&
              executionResult.skillResult.citations.length > 0
            ) {
              for (const citation of executionResult.skillResult.citations) {
                onCitation?.({
                  type: "citation",
                  data: citation,
                  timestamp: Date.now(),
                  conversationId,
                  requestId,
                });
              }
            }
          }

          // FIX G: close the feedback loop — the next LLM call must see this
          // turn's assistant tool-call message and the matching tool results.
          // Without it every step sends the model the same static
          // conversation and it blind-repeats save_lead until MAX_STEPS.
          const turnToolResults = toolResults.slice(toolResultsBefore);
          toolFeedback.push({
            id: `msg-${requestId}-assistant-tools-${steps}`,
            role: "assistant",
            content: response.content,
            timestamp: Date.now(),
            toolCalls: response.toolCalls,
          });
          for (const tr of turnToolResults) {
            toolFeedback.push({
              id: `msg-${requestId}-tool-${tr.toolCallId}`,
              role: "tool",
              content: tr.content,
              timestamp: Date.now(),
              toolCallId: tr.toolCallId,
              toolName: tr.toolName,
            });
          }

          // FIX G2: every call this turn targeted a tool that already
          // succeeded and the model still produced text — promote that text
          // to the final answer instead of spinning to MAX_STEPS.
          if (
            blockedThisTurn > 0 &&
            executedThisTurn === 0 &&
            response.content &&
            response.content.trim().length > 0
          ) {
            messages.push({
              id: `msg-${requestId}-assistant-${steps}`,
              role: "assistant",
              content: response.content,
              timestamp: Date.now(),
              toolCalls: response.toolCalls,
            });
            eventBus.emit("agent.response.completed", requestId, {
              durationMs: Date.now() - startTime,
            });
            return {
              finalResponse: response.content,
              messages,
              toolCalls,
              toolResults,
              usage: accumulatedUsage,
              finishReason: response.finishReason,
              steps,
              toolCallCount,
              durationMs: Date.now() - startTime,
              errors,
            };
          }

          // Continue loop for next LLM call with tool results
          continue;
        } else {
          // Final response — an empty one is not a response: fail instead of
          // persisting/showing a blank bubble.
          if (!response.content || response.content.trim().length === 0) {
            failGeneration("EMPTY_RESPONSE");
          }

          // FIX 4 (LOT 38a quater): forced tool_choice was violated — the
          // model answered with text instead of calling save_lead. Trace it
          // for diagnostics (defense in depth); the visitor still receives
          // the answer, the anomaly is auditable a posteriori.
          if (shouldForceSaveLead && (!response.toolCalls || response.toolCalls.length === 0)) {
            console.log("[Webi] forced_tool_choice_violated", {
              finishReason: response.finishReason,
              hasContent: !!response.content,
            });
            await auditLogger.logSecurityEvent("tool_execution_failure", {
              severity: "high",
              userId,
              sessionId,
              conversationId,
              requestId,
              eventData: {
                skill_name: "save_lead",
                error: "NIM violated forced tool_choice",
                guard_triggered: "forced_tool_choice",
                finishReason: response.finishReason,
              },
              errorMessage: "forced_tool_choice_violated",
            });
          }

          const assistantMsg: Message = {
            id: `msg-${requestId}-assistant-${steps}`,
            role: "assistant",
            content: response.content,
            timestamp: Date.now(),
            toolCalls: response.toolCalls,
          };
          messages.push(assistantMsg);

          // Emit response completed
          eventBus.emit("agent.response.completed", requestId, {
            durationMs: Date.now() - startTime,
          });

          return {
            finalResponse: response.content,
            messages,
            toolCalls,
            toolResults,
            usage: accumulatedUsage,
            finishReason: response.finishReason,
            steps,
            toolCallCount,
            durationMs: Date.now() - startTime,
            errors,
          };
        }
      } catch (error) {
        // Typed generation failure (empty response): already logged with its
        // cause — never remap to a provider error, never fall through to the
        // end-of-loop path.
        if (isGenerationFailure(error)) throw error;

        const llmDuration = Date.now() - llmStartTime;

        let agentError: AgentError;

        if (error instanceof ProviderError) {
          agentError = this.mapProviderError(error);
        } else if (error instanceof Error) {
          const providerErr = new ProviderError(
            error.message,
            "INTERNAL_ERROR",
            this.llmProvider.id,
            true,
          );
          agentError = this.createAgentError(
            "PROVIDER_ERROR",
            error.message,
            isRetryableError(providerErr),
            { provider: this.llmProvider.id },
          );
        } else {
          agentError = this.createAgentError(
            "UNKNOWN_ERROR",
            "Unknown error during LLM call",
            false,
          );
        }

        errors.push(agentError);

        // Observable failure signature: code + provider + NIM message excerpt.
        // Never prompt/user content — details may carry a provider error body.
        const detailText = extractProviderDetail(agentError.details);
        const providerLabel =
          typeof agentError.details?.provider === "string"
            ? agentError.details.provider
            : this.llmProvider.id;
        const concise = `LLM ${agentError.code} [${providerLabel}]: ${agentError.message}${
          detailText ? ` — ${detailText}` : ""
        }`;

        eventBus.emit("agent.error", requestId, {
          stage: "llm",
          message: concise,
        });
        console.error(`[Webi] ${concise} (request ${requestId})`);

        // If error is not recoverable, break
        if (!agentError.recoverable) {
          break;
        }

        // If recoverable, we could retry (but for simplicity, we break)
        break;
      }
    }

    // If we exited loop without final response
    if (steps >= this.limits.maxAgentSteps) {
      const maxStepsError = this.createAgentError(
        "MAX_STEPS_EXCEEDED",
        `Maximum agent steps (${this.limits.maxAgentSteps}) exceeded`,
        false,
        { steps, toolCallCount },
      );
      errors.push(maxStepsError);

      // Audit log for max steps exceeded
      await auditLogger.logSecurityEvent("max_steps_exceeded", {
        severity: "medium",
        userId,
        conversationId,
        requestId,
        eventData: { steps, toolCallCount, maxSteps: this.limits.maxAgentSteps },
        errorMessage: maxStepsError.message,
      });
    }

    // Loop ended without a final response (provider failure, in-loop
    // timeout, step limit): never replay the last assistant message from
    // history as the answer to this prompt — fail with a typed error.
    return failGeneration(errors.at(-1)?.code ?? "UNKNOWN_ERROR");
  }

  private async streamLLM(
    request: ProviderRequest,
    onStream: (event: TypedStreamEvent) => void | Promise<void>,
    conversationId: string,
    requestId: string,
  ): Promise<{
    response: ProviderResponse;
    reasoningChunks: number;
    ttftMs: number | null;
    chunkCount: number;
  }> {
    let fullContent = "";
    let toolCalls: ToolCall[] | undefined;
    let usage: ProviderResponse["usage"] | undefined;
    let finishReason: ProviderResponse["finishReason"] = "stop";
    let reasoningChunks = 0;
    let index = 0;
    let firstChunkAt: number | null = null;
    const streamStart = Date.now();

    for await (const chunk of this.llmProvider.stream(request)) {
      if (chunk.type === "chunk" && chunk.content) {
        firstChunkAt ??= Date.now();
        fullContent += chunk.content;
        // Awaited so a slow HTTP consumer throttles the provider read loop
        // (backpressure) instead of buffering the whole answer in memory.
        await onStream({
          type: "text_delta",
          data: { content: chunk.content, index: index++ },
          timestamp: Date.now(),
          conversationId,
          requestId,
        });
      } else if (chunk.type === "tool_calls" && chunk.toolCalls) {
        toolCalls = chunk.toolCalls;
      } else if (chunk.type === "done") {
        usage = chunk.usage;
        finishReason = chunk.finishReason ?? "stop";
        reasoningChunks = chunk.reasoningChunks ?? 0;
        if (chunk.toolCalls) {
          toolCalls = chunk.toolCalls;
        }
      } else if (chunk.type === "error") {
        const errorInfo = chunk.error ?? {
          code: "STREAM_ERROR",
          message: "Unknown stream error",
          recoverable: false,
        };
        throw new ProviderError(
          errorInfo.message,
          errorInfo.code as ProviderErrorCode,
          this.llmProvider.id,
          errorInfo.recoverable,
        );
      }
    }

    return {
      response: {
        id: `stream-${Date.now()}`,
        content: fullContent,
        model: request.model,
        usage: usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason,
        toolCalls,
      },
      reasoningChunks,
      ttftMs: firstChunkAt === null ? null : firstChunkAt - streamStart,
      chunkCount: index,
    };
  }

  private mapProviderError(error: ProviderError): AgentError {
    // Preserve provider details (e.g. NIM error body) for diagnosis.
    const details: Record<string, unknown> = { ...error.details, provider: error.provider };
    switch (error.code) {
      case "TIMEOUT":
        return this.createAgentError("PROVIDER_TIMEOUT", error.message, true, details);
      case "AUTHENTICATION_ERROR":
        return this.createAgentError("PROVIDER_AUTH_ERROR", error.message, false, details);
      case "RATE_LIMIT":
        return this.createAgentError("PROVIDER_RATE_LIMIT", error.message, true, details);
      case "UNAVAILABLE":
        return this.createAgentError("PROVIDER_UNAVAILABLE", error.message, true, details);
      case "INVALID_REQUEST":
        return this.createAgentError("PROVIDER_INVALID_REQUEST", error.message, false, details);
      default:
        return this.createAgentError("PROVIDER_ERROR", error.message, error.recoverable, details);
    }
  }

  private createAgentError(
    code: AgentErrorCode,
    message: string,
    recoverable: boolean,
    details?: Record<string, unknown>,
  ): AgentError {
    const error = new Error(message) as AgentError;
    error.code = code;
    error.recoverable = recoverable;
    error.details = details;
    return error;
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  getLimits(): AgentLimits {
    return { ...this.limits };
  }

  updateLimits(limits: Partial<AgentLimits>): void {
    this.limits = validateLimits({ ...this.limits, ...limits });
    this.config.limits = this.limits;
  }
}

// Helper functions (re-exported from context-builder)

/**
 * A typed generation failure thrown by failGeneration inside run() — it must
 * propagate untouched (never remapped to a provider error).
 */
function isGenerationFailure(error: unknown): error is AgentError {
  return error instanceof Error && "code" in error && error.code === "GENERATION_FAILED";
}

/**
 * First string found under common provider-error body keys, truncated.
 * Only provider error bodies flow here — never prompt or user content.
 */
function extractProviderDetail(details: Record<string, unknown> | undefined): string | undefined {
  if (!details) return undefined;
  for (const key of ["message", "detail", "title", "error"]) {
    const value: unknown = details[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.slice(0, 300);
    }
  }
  return undefined;
}

function estimateContextSize(context: AgentContext): number {
  let size = 0;
  size += Math.ceil(context.systemPrompt.length / 4);
  for (const msg of context.messages) {
    size += Math.ceil(msg.content.length / 4) + 50;
  }
  for (const tool of context.availableTools) {
    size += Math.ceil(JSON.stringify(tool).length / 4);
  }
  for (const doc of context.rag.documents) {
    size += Math.ceil(doc.content.length / 4) + Math.ceil(doc.title.length / 4) + 100;
  }
  size += Math.ceil(JSON.stringify(context.memory).length / 4);
  return size;
}

function checkContextSize(context: AgentContext, maxTokens: number): boolean {
  return estimateContextSize(context) <= maxTokens;
}
