import {
  EmbedOptions,
  EmbeddingProvider,
  ProviderConfig,
  ProviderError,
  ProviderErrorCode,
  mapHttpErrorToProviderError,
} from "../providers";
import { EMBEDDING_CONFIG, assertEmbeddingDimensions, resolveEmbeddingModel } from "./config";

export class NvidiaEmbeddingProvider implements EmbeddingProvider {
  readonly id = "nvidia";
  readonly name = "NVIDIA NIM Embeddings";
  readonly dimensions: number = EMBEDDING_CONFIG.dimensions;

  private config: ProviderConfig | null = null;
  private initialized = false;

  private abortController: AbortController | null = null;
  private abortReason: string | undefined;

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  isAvailable(): boolean {
    return this.initialized && !!this.config?.apiKey;
  }

  abort(reason?: string): void {
    this.abortReason = reason;
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

  async embed(text: string, options?: EmbedOptions): Promise<number[]> {
    const results = await this.batchEmbed([text], options);
    const first = results[0];
    if (!first) {
      throw new ProviderError("Empty embeddings response", "INVALID_RESPONSE", this.id, false);
    }
    return first;
  }

  async batchEmbed(texts: string[], options?: EmbedOptions): Promise<number[][]> {
    if (!this.initialized || !this.config) {
      throw new ProviderError(
        "Provider not initialized. Call initialize() first.",
        "INVALID_REQUEST",
        this.id,
        false,
      );
    }

    if (texts.length === 0) return [];

    const abortedError = (): ProviderError =>
      new ProviderError(this.abortReason ?? "Embedding request aborted", "ABORTED", this.id, false);

    const externalSignal = options?.signal;
    if (externalSignal?.aborted) {
      throw abortedError();
    }

    const controller = new AbortController();
    this.abortController = controller;
    this.abortReason = undefined;

    const onExternalAbort = (): void => controller.abort();
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.timeout);

    try {
      const response = await fetch(`${this.getBaseUrl()}/embeddings`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          // Single source of truth: EMBEDDING_CONFIG (env override allowed for
          // the model NAME only — dimensions stay enforced by the guard below).
          model: resolveEmbeddingModel(),
          input: texts,
          encoding_format: "float",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
      if (this.abortController === controller) this.abortController = null;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw mapHttpErrorToProviderError(response.status, this.id, errorData);
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        throw new ProviderError(
          "Invalid embeddings response format",
          "INVALID_RESPONSE",
          this.id,
          false,
        );
      }

      const vectors = (data.data as Array<{ index: number; embedding: unknown }>)
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((item) => {
          if (
            !Array.isArray(item.embedding) ||
            !item.embedding.every((n) => typeof n === "number")
          ) {
            throw new ProviderError(
              "Invalid embedding vector in response",
              "INVALID_RESPONSE",
              this.id,
              false,
            );
          }
          const vector = item.embedding as number[];
          // Fails loudly on dimension mismatch — never truncates/pads/slices.
          assertEmbeddingDimensions(vector);
          return vector;
        });

      if (vectors.length !== texts.length) {
        throw new ProviderError(
          `Embedding count mismatch: expected ${texts.length}, received ${vectors.length}`,
          "INVALID_RESPONSE",
          this.id,
          false,
        );
      }

      return vectors;
    } catch (error) {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
      if (this.abortController === controller) this.abortController = null;
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        // The internal timer and the abort() / external signal are the only
        // sources of abort: `timedOut` disambiguates them.
        if (timedOut) {
          throw new ProviderError("Embedding request timeout", "TIMEOUT", this.id, true);
        }
        throw new ProviderError(
          this.abortReason ?? "Embedding request aborted",
          "ABORTED",
          this.id,
          false,
        );
      }
      throw new ProviderError(
        error instanceof Error ? error.message : "Unknown embedding error",
        "UNAVAILABLE",
        this.id,
        true,
      );
    }
  }
}
