import {
  LLMProvider,
  StreamChunk,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  AIModel,
  TokenUsage,
  FinishReason,
  ToolCall,
  ToolDefinition,
  ProviderCapabilities,
} from "./types";
import { ProviderError, ProviderErrorCode, mapHttpErrorToProviderError } from "./errors";

interface NvidiaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: NvidiaToolCall[];
  tool_call_id?: string;
}

interface NvidiaToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface NvidiaToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface NvidiaRequest {
  model: string;
  messages: NvidiaMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: NvidiaToolDefinition[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

interface NvidiaResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: NvidiaChoice[];
  usage: NvidiaUsage;
}

interface NvidiaChoice {
  index: number;
  message: NvidiaMessage;
  finish_reason: string;
  delta?: NvidiaMessage;
}

interface NvidiaUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface NvidiaStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: NvidiaStreamChoice[];
}

interface NvidiaStreamChoice {
  index: number;
  delta: NvidiaMessage;
  finish_reason: string | null;
}

export class NvidiaProvider implements LLMProvider {
  readonly id = "nvidia";
  readonly name = "NVIDIA NIM";

  readonly models: AIModel[] = [
    {
      id: "nemotron-3-ultra",
      name: "Nemotron 3 Ultra",
      provider: "nvidia",
      capabilities: {
        streaming: true,
        toolCalling: true,
        structuredOutput: false,
        embeddings: false,
        vision: false,
      },
      maxTokens: 128_000,
      costPerToken: { input: 0, output: 0 },
    },
    {
      id: "llama-3.1-70b-instruct",
      name: "Llama 3.1 70B Instruct",
      provider: "nvidia",
      capabilities: {
        streaming: true,
        toolCalling: true,
        structuredOutput: false,
        embeddings: false,
        vision: false,
      },
      maxTokens: 128_000,
      costPerToken: { input: 0, output: 0 },
    },
    {
      id: "llama-3.1-8b-instruct",
      name: "Llama 3.1 8B Instruct",
      provider: "nvidia",
      capabilities: {
        streaming: true,
        toolCalling: true,
        structuredOutput: false,
        embeddings: false,
        vision: false,
      },
      maxTokens: 128_000,
      costPerToken: { input: 0, output: 0 },
    },
  ];

  private config: ProviderConfig | null = null;
  private abortController: AbortController | null = null;
  private initialized = false;

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  getModel(modelId: string): AIModel | undefined {
    return this.models.find((m) => m.id === modelId);
  }

  isAvailable(): boolean {
    return this.initialized && !!this.config?.apiKey;
  }

  abort(): void {
    this.abortController?.abort();
  }

  private getHeaders(): Record<string, string> {
    if (!this.config) {
      throw new ProviderError("Provider not initialized", "INVALID_REQUEST", this.id, false);
    }
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private getBaseUrl(): string {
    return this.config?.baseUrl ?? "https://integrate.api.nvidia.com/v1";
  }

  private mapMessages(messages: Message[]): NvidiaMessage[] {
    return messages.map((m) => {
      const base: NvidiaMessage = { role: m.role, content: m.content };
      if (m.role === "assistant" && "toolCalls" in m && m.toolCalls) {
        base.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }
      if (m.role === "tool") {
        base.role = "tool";
        base.tool_call_id = m.toolCallId;
      }
      return base;
    });
  }

  private mapTools(tools?: ToolDefinition[]): NvidiaToolDefinition[] | undefined {
    return tools?.map((t) => ({
      type: "function" as const,
      function: t.function,
    }));
  }

  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool_calls":
        return "tool_calls";
      default:
        return "error";
    }
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    this.ensureInitialized();
    this.abortController = new AbortController();

    const timeout = setTimeout(() => this.abortController?.abort(), this.config!.timeout);

    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(this.buildRequest(request, false)),
        signal: this.abortController.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw mapHttpErrorToProviderError(response.status, this.id, errorData);
      }

      const data: NvidiaResponse = await response.json();
      return this.mapResponse(data);
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderError("Request timeout", "TIMEOUT", this.id, true);
      }
      throw new ProviderError(
        error instanceof Error ? error.message : "Unknown error",
        "UNAVAILABLE",
        this.id,
        true,
      );
    }
  }

  async *stream(request: ProviderRequest): AsyncIterable<StreamChunk> {
    this.ensureInitialized();
    this.abortController = new AbortController();

    const timeout = setTimeout(() => this.abortController?.abort(), this.config!.timeout);

    let index = 0;
    let accumulatedContent = "";
    let toolCalls: ToolCall[] | undefined;

    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(this.buildRequest(request, true)),
        signal: this.abortController.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw mapHttpErrorToProviderError(response.status, this.id, errorData);
      }

      if (!response.body) {
        throw new ProviderError("No response body", "INVALID_RESPONSE", this.id, false);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const chunk: NvidiaStreamChunk = JSON.parse(data);
            const choice = chunk.choices[0];
            if (!choice) continue;

            if (choice.delta.content) {
              accumulatedContent += choice.delta.content;
              yield {
                type: "chunk",
                content: choice.delta.content,
                index: index++,
              };
            }

            if (choice.delta.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                if (!toolCalls) toolCalls = [];
                if (tc.index !== undefined && tc.index >= toolCalls.length) {
                  toolCalls.push({
                    id: tc.id,
                    type: "function",
                    function: {
                      name: tc.function?.name ?? "",
                      arguments: tc.function?.arguments ?? "",
                    },
                  });
                } else if (tc.function?.arguments) {
                  const last = toolCalls[toolCalls.length - 1];
                  if (last) last.function.arguments += tc.function.arguments;
                }
              }
            }

            if (choice.finish_reason) {
              const finishReason = this.mapFinishReason(choice.finish_reason);
              if (toolCalls && toolCalls.length > 0) {
                yield { type: "tool_calls", toolCalls, index: index++ };
              }
              yield {
                type: "done",
                content: accumulatedContent,
                toolCalls,
                finishReason,
                usage: chunk.usage ? this.mapUsage(chunk.usage) : undefined,
                index: index++,
              };
              return;
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof ProviderError) {
        yield {
          type: "error",
          error: { code: error.code, message: error.message, recoverable: error.recoverable },
          index: index++,
        };
        return;
      }
      if (error instanceof Error && error.name === "AbortError") {
        yield {
          type: "error",
          error: { code: "TIMEOUT", message: "Request timeout", recoverable: true },
          index: index++,
        };
        return;
      }
      yield {
        type: "error",
        error: {
          code: "STREAM_ERROR",
          message: error instanceof Error ? error.message : "Stream error",
          recoverable: true,
        },
        index: index++,
      };
    }
  }

  private buildRequest(request: ProviderRequest, stream: boolean): NvidiaRequest {
    return {
      model: request.model,
      messages: this.mapMessages(request.messages),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream,
      tools: this.mapTools(request.tools),
      tool_choice: request.tools?.length ? "auto" : undefined,
    };
  }

  private mapResponse(data: NvidiaResponse): ProviderResponse {
    const choice = data.choices[0];
    const message = choice.message;
    const toolCalls = message.tool_calls?.map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    }));

    return {
      id: data.id,
      content: message.content ?? "",
      model: data.model,
      usage: this.mapUsage(data.usage),
      finishReason: this.mapFinishReason(choice.finish_reason),
      toolCalls,
    };
  }

  private mapUsage(usage: NvidiaUsage): TokenUsage {
    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new ProviderError(
        "Provider not initialized. Call initialize() first.",
        "INVALID_REQUEST",
        this.id,
        false,
      );
    }
  }
}
