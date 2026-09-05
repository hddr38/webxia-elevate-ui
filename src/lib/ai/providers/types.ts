import type {
  Message,
  ToolDefinition,
  ToolCall,
  ProviderCapabilities,
  AIModel,
  TokenUsage,
  FinishReason,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
} from "../contracts";

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  readonly models: AIModel[];

  initialize(config: ProviderConfig): Promise<void>;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  stream(request: ProviderRequest): AsyncIterable<StreamChunk>;
  abort(): void;
  getModel(modelId: string): AIModel | undefined;
  isAvailable(): boolean;
}

export interface StreamChunk {
  type: "chunk" | "done" | "error" | "tool_calls";
  content?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason?: FinishReason;
  error?: { code: string; message: string; recoverable: boolean };
  index: number;
}

export interface ProviderRegistry {
  register(provider: LLMProvider): void;
  unregister(providerId: string): void;
  get(providerId: string): LLMProvider | undefined;
  getAll(): LLMProvider[];
  getActive(): LLMProvider;
  setActive(providerId: string): void;
  getDefaultModel(): AIModel;
}

export interface ModelRouterConfig {
  primaryProvider: string;
  primaryModel: string;
  fallbackProvider?: string;
  fallbackModel?: string;
  enableFallback: boolean;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly name: string;
  readonly dimensions: number;

  initialize(config: ProviderConfig): Promise<void>;
  embed(text: string): Promise<number[]>;
  batchEmbed(texts: string[]): Promise<number[][]>;
  isAvailable(): boolean;
}
