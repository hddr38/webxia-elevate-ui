import { LLMProvider, ModelRouterConfig, ProviderRegistry, AIModel, ProviderConfig } from "./types";
import { ProviderError, ProviderErrorCode } from "./errors";
import { NvidiaProvider } from "./nvidia";

export class ModelRouter implements ProviderRegistry {
  private providers = new Map<string, LLMProvider>();
  private config: ModelRouterConfig;
  private activeProviderId: string;

  constructor(config: ModelRouterConfig) {
    this.config = config;
    this.activeProviderId = config.primaryProvider;
  }

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregister(providerId: string): void {
    this.providers.delete(providerId);
  }

  get(providerId: string): LLMProvider | undefined {
    return this.providers.get(providerId);
  }

  getAll(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  getActive(): LLMProvider {
    const provider = this.providers.get(this.activeProviderId);
    if (!provider) {
      throw new ProviderError(
        `Active provider ${this.activeProviderId} not found`,
        "UNAVAILABLE",
        this.activeProviderId,
        false,
      );
    }
    return provider;
  }

  setActive(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new ProviderError(
        `Provider ${providerId} not registered`,
        "INVALID_REQUEST",
        providerId,
        false,
      );
    }
    this.activeProviderId = providerId;
  }

  getDefaultModel(): AIModel {
    const provider = this.getActive();
    const model = provider.getModel(this.config.primaryModel);
    if (!model) {
      throw new ProviderError(
        `Model ${this.config.primaryModel} not found in provider ${this.activeProviderId}`,
        "INVALID_REQUEST",
        this.activeProviderId,
        false,
      );
    }
    return model;
  }

  async initializeAll(configs: Record<string, ProviderConfig>): Promise<void> {
    for (const [id, provider] of this.providers) {
      const config = configs[id];
      if (config) {
        await provider.initialize(config);
      }
    }
  }

  async completeWithFallback(
    request: Parameters<LLMProvider["complete"]>[0],
  ): Promise<ReturnType<LLMProvider["complete"]>> {
    const primary = this.get(this.config.primaryProvider);
    if (!primary) {
      throw new ProviderError(
        "Primary provider not registered",
        "UNAVAILABLE",
        this.config.primaryProvider,
        false,
      );
    }

    try {
      return await primary.complete(request);
    } catch (error) {
      if (this.shouldFallback(error) && this.config.fallbackProvider) {
        const fallback = this.get(this.config.fallbackProvider!);
        if (fallback) {
          const fallbackRequest = { ...request, model: this.config.fallbackModel ?? request.model };
          return await fallback.complete(fallbackRequest);
        }
      }
      throw error;
    }
  }

  async *streamWithFallback(
    request: Parameters<LLMProvider["stream"]>[0],
  ): AsyncIterable<ReturnType<LLMProvider["stream"]> extends AsyncIterable<infer T> ? T : never> {
    const primary = this.get(this.config.primaryProvider);
    if (!primary) {
      throw new ProviderError(
        "Primary provider not registered",
        "UNAVAILABLE",
        this.config.primaryProvider,
        false,
      );
    }

    try {
      for await (const chunk of primary.stream(request)) {
        yield chunk;
      }
    } catch (error) {
      if (this.shouldFallback(error) && this.config.fallbackProvider) {
        const fallback = this.get(this.config.fallbackProvider!);
        if (fallback) {
          const fallbackRequest = { ...request, model: this.config.fallbackModel ?? request.model };
          for await (const chunk of fallback.stream(fallbackRequest)) {
            yield chunk;
          }
          return;
        }
      }
      throw error;
    }
  }

  private shouldFallback(error: unknown): boolean {
    if (!this.config.enableFallback) return false;
    if (!(error instanceof ProviderError)) return false;
    return (
      error.recoverable &&
      (error.code === "UNAVAILABLE" || error.code === "TIMEOUT" || error.code === "RATE_LIMIT")
    );
  }

  getConfig(): ModelRouterConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ModelRouterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export function createModelRouter(config?: Partial<ModelRouterConfig>): ModelRouter {
  const defaultConfig: ModelRouterConfig = {
    primaryProvider: "nvidia",
    primaryModel: "nemotron-3-ultra",
    fallbackProvider: undefined,
    fallbackModel: undefined,
    enableFallback: false,
    ...config,
  };

  const router = new ModelRouter(defaultConfig);
  router.register(new NvidiaProvider());
  return router;
}
