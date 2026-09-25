import {
  LLMProvider,
  ModelRouterConfig,
  ProviderRegistry,
  AIModel,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  StreamChunk,
} from "./types";
import { ProviderError } from "./errors";
import { NvidiaProvider } from "./nvidia";

const FALLBACK_CODES = new Set(["UNAVAILABLE", "TIMEOUT", "RATE_LIMIT"]);

export class ModelRouter implements ProviderRegistry, LLMProvider {
  private providers = new Map<string, LLMProvider>();
  private config: ModelRouterConfig;
  private activeProviderId: string;
  /** Once the fallback engaged in this request (routers are per-request in
   * chat), every later call — e.g. tool-loop steps — goes straight to the
   * fallback model instead of re-paying the primary's timeout. */
  private fallbackEngaged = false;

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

  // ---------------------------------------------------------------------
  // LLMProvider surface — the router IS the provider handed to the
  // orchestrator (chat.ts), so fallback actually runs in production.
  // ---------------------------------------------------------------------

  get id(): string {
    return this.get(this.activeProviderId)?.id ?? this.config.primaryProvider;
  }

  get name(): string {
    return this.get(this.activeProviderId)?.name ?? "Model Router";
  }

  get models(): AIModel[] {
    return this.get(this.activeProviderId)?.models ?? [];
  }

  async initialize(config: ProviderConfig): Promise<void> {
    await this.getActive().initialize(config);
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    return this.completeWithFallback(request);
  }

  stream(request: ProviderRequest): AsyncIterable<StreamChunk> {
    return this.streamWithFallback(request);
  }

  abort(): void {
    this.get(this.activeProviderId)?.abort();
  }

  getModel(modelId: string): AIModel | undefined {
    return this.get(this.activeProviderId)?.getModel(modelId);
  }

  isAvailable(): boolean {
    return this.get(this.activeProviderId)?.isAvailable() ?? false;
  }

  // ---------------------------------------------------------------------
  // Fallback core
  // ---------------------------------------------------------------------

  async completeWithFallback(request: ProviderRequest): Promise<ProviderResponse> {
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
      return await primary.complete(this.primedRequest(request));
    } catch (error) {
      if (this.shouldFallback(error) && this.config.fallbackProvider) {
        const fallback = this.get(this.config.fallbackProvider);
        if (fallback) {
          const model = this.config.fallbackModel ?? request.model;
          const reason = error instanceof ProviderError ? error.code : "UNKNOWN";
          this.logFallback(model, reason);
          this.fallbackEngaged = true;
          return await fallback.complete({ ...request, model });
        }
      }
      throw error;
    }
  }

  /**
   * Stream from the primary provider and switch to the fallback mid-flight.
   *
   * NvidiaProvider.stream() never throws — failures arrive as yielded
   * `{type:"error"}` chunks — so the switch inspects chunks inline. Rules:
   * - recoverable fallback-eligible error BEFORE any content → switch;
   * - error after content was forwarded → forward it (switching would
   *   duplicate text the consumer already received);
   * - primary ended with NO chunk at all (in-band error swallowed upstream)
   *   → treat as empty stream and switch.
   */
  async *streamWithFallback(request: ProviderRequest): AsyncIterable<StreamChunk> {
    const primary = this.get(this.config.primaryProvider);
    if (!primary) {
      throw new ProviderError(
        "Primary provider not registered",
        "UNAVAILABLE",
        this.config.primaryProvider,
        false,
      );
    }

    let emitted = false;
    const primaryRequest = this.primedRequest(request);

    for await (const chunk of primary.stream(primaryRequest)) {
      if (chunk.type === "error") {
        const err = chunk.error;
        if (!emitted && err && this.isFallbackEligible(err.code, err.recoverable)) {
          const fallbackStream = this.openFallbackStream(request, err.code);
          if (fallbackStream) {
            yield* fallbackStream;
            return;
          }
        }
        yield chunk;
        return;
      }
      emitted = true;
      yield chunk;
    }

    if (!emitted) {
      const fallbackStream = this.openFallbackStream(request, "EMPTY_STREAM");
      if (fallbackStream) {
        yield* fallbackStream;
      }
    }
  }

  private openFallbackStream(
    request: ProviderRequest,
    reason: string,
  ): AsyncIterable<StreamChunk> | null {
    if (this.fallbackEngaged) return null;
    if (!this.config.enableFallback || !this.config.fallbackProvider) return null;
    const fallback = this.get(this.config.fallbackProvider);
    if (!fallback) return null;
    const model = this.config.fallbackModel ?? request.model;
    this.fallbackEngaged = true;
    this.logFallback(model, reason);
    return fallback.stream({ ...request, model });
  }

  /** After the fallback engaged, later calls use the fallback model on the
   * primary provider path (same instance here) — no second 45s timeout. */
  private primedRequest(request: ProviderRequest): ProviderRequest {
    if (this.fallbackEngaged && this.config.fallbackModel) {
      return { ...request, model: this.config.fallbackModel };
    }
    return request;
  }

  private logFallback(targetModel: string, reason: string): void {
    console.warn(
      `[Webi] FALLBACK ${this.config.primaryProvider}/${this.config.primaryModel} → ${targetModel} (${reason})`,
    );
  }

  private isFallbackEligible(code: string, recoverable: boolean): boolean {
    if (!this.config.enableFallback) return false;
    if (!recoverable) return false;
    return FALLBACK_CODES.has(code);
  }

  private shouldFallback(error: unknown): boolean {
    if (!(error instanceof ProviderError)) return false;
    return this.isFallbackEligible(error.code, error.recoverable);
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
    primaryModel: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    fallbackProvider: undefined,
    fallbackModel: undefined,
    enableFallback: false,
    ...config,
  };

  const router = new ModelRouter(defaultConfig);
  router.register(new NvidiaProvider());
  return router;
}
