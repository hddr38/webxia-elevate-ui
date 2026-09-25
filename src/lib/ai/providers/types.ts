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
  LLMProvider,
  EmbeddingProvider,
  StreamChunk,
} from "../contracts";

export type {
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
  LLMProvider,
  EmbeddingProvider,
  StreamChunk,
};

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
