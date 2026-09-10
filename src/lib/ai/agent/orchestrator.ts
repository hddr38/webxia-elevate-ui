import { AgentConfig, createAgentConfig, validateLimits } from "./agent-limits";
import { buildAgentContext, truncateContext } from "./context-builder";
import { skillExecutor, SkillExecutor } from "../skills";
import { skillRegistry, getAllToolDefinitions } from "../skills";
import { eventBus } from "../events";
import { auditLogger } from "../security/audit-log";
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
  onStream?: (event: TypedStreamEvent) => void;
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
        conversationHistory: messages,
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

      // Prepare provider request
      const providerRequest: ProviderRequest = {
        model: this.config.defaultModel,
        messages: agentContext.messages,
        systemPrompt: agentContext.systemPrompt,
        tools: agentContext.availableTools,
        temperature: 0.7,
        maxTokens: 2000,
        stream,
      };

      // Emit LLM started
      eventBus.emit("agent.llm.started", requestId, {
        model: this.config.defaultModel,
      });

      const llmStartTime = Date.now();

      try {
        let response: ProviderResponse;
        let reasoningChunks = 0;

        if (stream && onStream) {
          const streamed = await this.streamLLM(
            providerRequest,
            onStream,
            conversationId,
            requestId,
          );
          response = streamed.response;
          reasoningChunks = streamed.reasoningChunks;
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
        });

        // Handle response
        if (
          response.finishReason === "tool_calls" &&
          response.toolCalls &&
          response.toolCalls.length > 0
        ) {
          // Tool calls requested
          for (const toolCall of response.toolCalls) {
            if (toolCallCount >= this.limits.maxToolCalls) {
              const limitError = this.createAgentError(
                "MAX_TOOL_CALLS_EXCEEDED",
                `Maximum tool calls (${this.limits.maxToolCalls}) exceeded`,
                false,
                { toolCallCount },
              );
              errors.push(limitError);
              break;
            }

            toolCallCount++;
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
              JSON.parse(toolCall.function.arguments),
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

          // Continue loop for next LLM call with tool results
          continue;
        } else {
          // Final response
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

    // Return what we have
    const lastAssistantMsg = messages.filter((m) => m.role === "assistant").pop();
    return {
      finalResponse:
        lastAssistantMsg?.content ?? "Je n'ai pas pu générer de réponse. Veuillez réessayer.",
      messages,
      toolCalls,
      toolResults,
      usage: accumulatedUsage,
      finishReason: "error",
      steps,
      toolCallCount,
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  private async streamLLM(
    request: ProviderRequest,
    onStream: (event: TypedStreamEvent) => void,
    conversationId: string,
    requestId: string,
  ): Promise<{ response: ProviderResponse; reasoningChunks: number }> {
    let fullContent = "";
    let toolCalls: ToolCall[] | undefined;
    let usage: ProviderResponse["usage"] | undefined;
    let finishReason: ProviderResponse["finishReason"] = "stop";
    let reasoningChunks = 0;
    let index = 0;

    for await (const chunk of this.llmProvider.stream(request)) {
      if (chunk.type === "chunk" && chunk.content) {
        fullContent += chunk.content;
        onStream({
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
