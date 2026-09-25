import { describe, it, expect, vi, beforeEach } from "vitest";
import { NvidiaProvider } from "../providers/nvidia";
import { NvidiaEmbeddingProvider } from "../embeddings/nvidia";
import { ModelRouter, createModelRouter } from "../providers/model-router";
import type { AIModel, StreamChunk } from "../contracts";
import {
  ProviderError,
  ProviderErrorCode,
  isRetryableError,
  mapHttpErrorToProviderError,
} from "../providers/errors";
import { createMockProvider, createMockRequest, createMockStreamRequest } from "./test-utils";
import { EMBEDDING_CONFIG } from "../embeddings/config";

describe("Provider Errors", () => {
  it("creates retryable errors correctly", () => {
    const timeoutError = new ProviderError("Timeout", "TIMEOUT", "test", true);
    const rateLimitError = new ProviderError("Rate limited", "RATE_LIMIT", "test", true);
    const unavailableError = new ProviderError("Unavailable", "UNAVAILABLE", "test", true);

    expect(isRetryableError(timeoutError)).toBe(true);
    expect(isRetryableError(rateLimitError)).toBe(true);
    expect(isRetryableError(unavailableError)).toBe(true);
  });

  it("creates non-retryable errors correctly", () => {
    const authError = new ProviderError("Auth failed", "AUTHENTICATION_ERROR", "test", false);
    const invalidRequestError = new ProviderError(
      "Invalid request",
      "INVALID_REQUEST",
      "test",
      false,
    );

    expect(isRetryableError(authError)).toBe(false);
    expect(isRetryableError(invalidRequestError)).toBe(false);
  });

  it("maps HTTP errors correctly", () => {
    expect(mapHttpErrorToProviderError(400, "test").code).toBe("INVALID_REQUEST");
    expect(mapHttpErrorToProviderError(401, "test").code).toBe("AUTHENTICATION_ERROR");
    expect(mapHttpErrorToProviderError(429, "test").code).toBe("RATE_LIMIT");
    expect(mapHttpErrorToProviderError(500, "test").code).toBe("UNAVAILABLE");
    expect(mapHttpErrorToProviderError(503, "test").code).toBe("UNAVAILABLE");
    expect(mapHttpErrorToProviderError(404, "test").code).toBe("INVALID_RESPONSE");
  });
});

describe("NvidiaProvider", () => {
  let provider: NvidiaProvider;

  beforeEach(() => {
    provider = new NvidiaProvider();
  });

  it("has correct id and name", () => {
    expect(provider.id).toBe("nvidia");
    expect(provider.name).toBe("NVIDIA NIM");
  });

  it("has models defined", () => {
    expect(provider.models.length).toBe(2);
    expect(provider.models.some((m) => m.id === "nvidia/nemotron-3.5-lightning-30b-a3b")).toBe(
      true,
    );
    expect(
      provider.models.some((m) => m.id === "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"),
    ).toBe(true);
  });

  it("returns model by id", () => {
    const model = provider.getModel("nvidia/nemotron-3.5-lightning-30b-a3b");
    expect(model).toBeDefined();
    expect(model?.id).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
  });

  it("returns undefined for unknown model", () => {
    expect(provider.getModel("unknown")).toBeUndefined();
  });

  it("is not available before initialization", () => {
    expect(provider.isAvailable()).toBe(false);
  });

  it("throws when completing without initialization", async () => {
    await expect(provider.complete(createMockRequest())).rejects.toThrow(
      "Provider not initialized",
    );
  });

  it("throws when streaming without initialization", async () => {
    const stream = provider.stream(createMockStreamRequest())[Symbol.asyncIterator]();
    await expect(stream.next()).rejects.toThrow("Provider not initialized");
  });

  it("initializes correctly", async () => {
    await provider.initialize({
      apiKey: "test-key",
      baseUrl: "https://test.api/v1",
      timeout: 30000,
      maxRetries: 2,
    });
    expect(provider.isAvailable()).toBe(true);
  });
});

describe("NvidiaEmbeddingProvider", () => {
  let provider: NvidiaEmbeddingProvider;

  beforeEach(() => {
    provider = new NvidiaEmbeddingProvider();
  });

  it("has correct id, name, and dimensions from EmbeddingConfig", () => {
    expect(provider.id).toBe("nvidia");
    expect(provider.name).toBe("NVIDIA NIM Embeddings");
    expect(provider.dimensions).toBe(EMBEDDING_CONFIG.dimensions);
    expect(provider.dimensions).toBe(2048);
  });

  it("is not available before initialization", () => {
    expect(provider.isAvailable()).toBe(false);
  });

  it("throws when embedding without initialization", async () => {
    await expect(provider.embed("test")).rejects.toThrow("Provider not initialized");
  });

  it("throws when batch embedding without initialization", async () => {
    await expect(provider.batchEmbed(["test"])).rejects.toThrow("Provider not initialized");
  });

  it("initializes correctly", async () => {
    await provider.initialize({
      apiKey: "test-key",
      baseUrl: "https://test.api/v1",
      timeout: 30000,
      maxRetries: 2,
    });
    expect(provider.isAvailable()).toBe(true);
  });

  function mockEmbeddingFetch(vectors: number[][] | "invalid" | { status: number }) {
    return vi.fn().mockImplementation(() => {
      if (typeof vectors === "object" && !Array.isArray(vectors) && "status" in vectors) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "error" }), { status: vectors.status }),
        );
      }
      const data =
        vectors === "invalid"
          ? { unexpected: true }
          : {
              data: (vectors as number[][]).map((embedding, index) => ({ index, embedding })),
            };
      return Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
    });
  }

  async function initProvider() {
    await provider.initialize({
      apiKey: "test-key",
      baseUrl: "https://test.api/v1",
      timeout: 30000,
      maxRetries: 2,
    });
  }

  function dims(n: number): number[] {
    return new Array(n).fill(0.1);
  }

  it("accepts 2048-dim embeddings and preserves index order", async () => {
    await initProvider();
    const fetchMock = mockEmbeddingFetch([dims(2048), dims(2048)]);
    vi.stubGlobal("fetch", fetchMock);

    try {
      const vectors = await provider.batchEmbed(["b", "a-reordered"]);
      expect(vectors).toHaveLength(2);
      expect(vectors[0]).toHaveLength(2048);
      expect(vectors[1]).toHaveLength(2048);
      const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as { model: string };
      expect(body.model).toBe("nvidia/nemotron-3-embed-1b");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects wrong-dimension vectors without resizing", async () => {
    await initProvider();
    vi.stubGlobal("fetch", mockEmbeddingFetch([dims(1536)]));
    try {
      await expect(provider.batchEmbed(["test"])).rejects.toThrow(/dimension/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects embedding count mismatches", async () => {
    await initProvider();
    vi.stubGlobal("fetch", mockEmbeddingFetch([dims(2048)]));
    try {
      await expect(provider.batchEmbed(["one", "two"])).rejects.toThrow(/count mismatch/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects invalid response shapes", async () => {
    await initProvider();
    vi.stubGlobal("fetch", mockEmbeddingFetch("invalid"));
    try {
      await expect(provider.batchEmbed(["test"])).rejects.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps HTTP 400 to INVALID_REQUEST", async () => {
    await initProvider();
    vi.stubGlobal("fetch", mockEmbeddingFetch({ status: 400 }));
    try {
      await expect(provider.batchEmbed(["test"])).rejects.toMatchObject({
        code: "INVALID_REQUEST",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps HTTP 429 to recoverable RATE_LIMIT", async () => {
    await initProvider();
    vi.stubGlobal("fetch", mockEmbeddingFetch({ status: 429 }));
    try {
      await expect(provider.batchEmbed(["test"])).rejects.toMatchObject({
        code: "RATE_LIMIT",
        recoverable: true,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps HTTP 5xx to recoverable UNAVAILABLE", async () => {
    await initProvider();
    vi.stubGlobal("fetch", mockEmbeddingFetch({ status: 503 }));
    try {
      await expect(provider.batchEmbed(["test"])).rejects.toMatchObject({
        code: "UNAVAILABLE",
        recoverable: true,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns [] for empty batch without calling fetch", async () => {
    await initProvider();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(provider.batchEmbed([])).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  function pendingFetch() {
    return vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const abortErr = (): Error => {
          const err = new Error("This operation was aborted");
          err.name = "AbortError";
          return err;
        };
        if (init.signal?.aborted) {
          reject(abortErr());
          return;
        }
        init.signal?.addEventListener("abort", () => reject(abortErr()), { once: true });
      });
    });
  }

  it("embed resolves a single 2048-dim vector (nominal)", async () => {
    await initProvider();
    vi.stubGlobal("fetch", mockEmbeddingFetch([dims(2048)]));
    try {
      const vector = await provider.embed("hello");
      expect(vector).toHaveLength(2048);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("abort() interrupts an in-flight request with a typed ABORTED error", async () => {
    await initProvider();
    vi.stubGlobal("fetch", pendingFetch());
    try {
      const pending = provider.batchEmbed(["test"]);
      provider.abort("caller cancelled");
      await expect(pending).rejects.toMatchObject({
        name: "ProviderError",
        code: "ABORTED",
        recoverable: false,
        message: "caller cancelled",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("propagates an external AbortSignal passed via options", async () => {
    await initProvider();
    vi.stubGlobal("fetch", pendingFetch());
    try {
      const controller = new AbortController();
      const pending = provider.embed("test", { signal: controller.signal });
      controller.abort();
      await expect(pending).rejects.toMatchObject({
        code: "ABORTED",
        recoverable: false,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects immediately with ABORTED when the external signal is already aborted", async () => {
    await initProvider();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const controller = new AbortController();
      controller.abort();
      await expect(provider.embed("test", { signal: controller.signal })).rejects.toMatchObject({
        code: "ABORTED",
        recoverable: false,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the internal timeout typed as recoverable TIMEOUT", async () => {
    await provider.initialize({
      apiKey: "test-key",
      baseUrl: "https://test.api/v1",
      timeout: 5,
      maxRetries: 1,
    });
    vi.stubGlobal("fetch", pendingFetch());
    try {
      await expect(provider.batchEmbed(["slow"])).rejects.toMatchObject({
        code: "TIMEOUT",
        recoverable: true,
        message: "Embedding request timeout",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("stays usable after abort() (fresh controller per request)", async () => {
    await initProvider();
    vi.stubGlobal("fetch", pendingFetch());
    try {
      const pending = provider.batchEmbed(["first"]);
      provider.abort();
      await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
    } finally {
      vi.unstubAllGlobals();
    }

    vi.stubGlobal("fetch", mockEmbeddingFetch([dims(2048)]));
    try {
      const vector = await provider.embed("next");
      expect(vector).toHaveLength(2048);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("ModelRouter", () => {
  let router: ModelRouter;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    router = new ModelRouter({
      primaryProvider: "test",
      primaryModel: "test-model",
      enableFallback: true,
      fallbackProvider: "fallback",
      fallbackModel: "fallback-model",
    });
    router.register(mockProvider);
  });

  it("registers and retrieves providers", () => {
    expect(router.get("test")).toBe(mockProvider);
    expect(router.getAll()).toContain(mockProvider);
  });

  it("gets active provider", () => {
    expect(router.getActive()).toBe(mockProvider);
  });

  it("sets active provider", () => {
    const anotherProvider = createMockProvider({ id: "another" });
    router.register(anotherProvider);
    router.setActive("another");
    expect(router.getActive()).toBe(anotherProvider);
  });

  it("throws when setting unknown provider as active", () => {
    expect(() => router.setActive("unknown")).toThrow("not registered");
  });

  it("gets default model", () => {
    const model = router.getDefaultModel();
    expect(model.id).toBe("test-model");
  });

  it("throws when default model not found", () => {
    const router2 = new ModelRouter({
      primaryProvider: "test",
      primaryModel: "nonexistent",
      enableFallback: false,
    });
    const mockProvider2 = createMockProvider({
      getModel: vi.fn<(modelId: string) => AIModel | undefined>().mockReturnValue(undefined),
    });
    router2.register(mockProvider2);
    expect(() => router2.getDefaultModel()).toThrow("not found");
  });

  it("completes with primary provider", async () => {
    const result = await router.completeWithFallback(createMockRequest());
    expect(result.content).toBe("Test response");
    expect(mockProvider.complete).toHaveBeenCalled();
  });

  it("streams with primary provider", async () => {
    const chunks: StreamChunk[] = [];
    for await (const chunk of router.streamWithFallback(createMockStreamRequest())) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(mockProvider.stream).toHaveBeenCalled();
  });

  it("falls back on retryable error when enabled", async () => {
    const fallbackProvider = createMockProvider({ id: "fallback" });
    router.register(fallbackProvider);

    mockProvider.complete.mockRejectedValueOnce(
      new ProviderError("Unavailable", "UNAVAILABLE", "test", true),
    );

    const result = await router.completeWithFallback(createMockRequest());
    expect(result.content).toBe("Test response");
    expect(fallbackProvider.complete).toHaveBeenCalled();
  });

  it("does not fallback when disabled", async () => {
    const routerNoFallback = new ModelRouter({
      primaryProvider: "test",
      primaryModel: "test-model",
      enableFallback: false,
    });
    routerNoFallback.register(mockProvider);

    mockProvider.complete.mockRejectedValueOnce(
      new ProviderError("Unavailable", "UNAVAILABLE", "test", true),
    );

    await expect(routerNoFallback.completeWithFallback(createMockRequest())).rejects.toThrow();
  });

  it("does not fallback on non-retryable error", async () => {
    const fallbackProvider = createMockProvider({ id: "fallback" });
    router.register(fallbackProvider);

    mockProvider.complete.mockRejectedValueOnce(
      new ProviderError("Invalid request", "INVALID_REQUEST", "test", false),
    );

    await expect(router.completeWithFallback(createMockRequest())).rejects.toThrow(
      "Invalid request",
    );
    expect(fallbackProvider.complete).not.toHaveBeenCalled();
  });

  it("creates model router with NVIDIA provider", () => {
    const router = createModelRouter();
    expect(router.get("nvidia")).toBeInstanceOf(NvidiaProvider);
  });
});
