import {
  EmbeddingProvider,
  ProviderConfig,
  ProviderError,
  ProviderErrorCode,
  mapHttpErrorToProviderError,
} from "../providers";

export class NvidiaEmbeddingProvider implements EmbeddingProvider {
  readonly id = "nvidia";
  readonly name = "NVIDIA NIM Embeddings";
  readonly dimensions = 1536;

  private config: ProviderConfig | null = null;
  private initialized = false;

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  isAvailable(): boolean {
    return this.initialized && !!this.config?.apiKey;
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

  async embed(text: string): Promise<number[]> {
    const results = await this.batchEmbed([text]);
    return results[0];
  }

  async batchEmbed(texts: string[]): Promise<number[][]> {
    if (!this.initialized || !this.config) {
      throw new ProviderError(
        "Provider not initialized. Call initialize() first.",
        "INVALID_REQUEST",
        this.id,
        false,
      );
    }

    if (texts.length === 0) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.getBaseUrl()}/embeddings`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: "nvidia/nv-embedqa-e5-v5",
          input: texts,
          encoding_format: "float",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

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

      return data.data
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((item: { embedding: number[] }) => item.embedding);
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderError("Embedding request timeout", "TIMEOUT", this.id, true);
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
