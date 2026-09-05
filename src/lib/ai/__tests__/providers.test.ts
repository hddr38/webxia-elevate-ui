import { describe, it, expect, vi, beforeEach } from "vitest";
import { NvidiaProvider } from "../providers/nvidia";
import { NvidiaEmbeddingProvider } from "../embeddings/nvidia";
import { ModelRouter, createModelRouter } from "../providers/model-router";
import {
  ProviderError,
  ProviderErrorCode,
  isRetryableError,
  mapHttpErrorToProviderError,
} from "../providers/errors";
import { createMockProvider, createMockRequest, createMockStreamRequest } from "./test-utils";

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
    expect(provider.models.length).toBeGreaterThan(0);
    expect(provider.models.some((m) => m.id === "nemotron-3-ultra")).toBe(true);
    expect(provider.models.some((m) => m.id === "llama-3.1-70b-instruct")).toBe(true);
  });

  it("returns model by id", () => {
    const model = provider.getModel("nemotron-3-ultra");
    expect(model).toBeDefined();
    expect(model?.id).toBe("nemotron-3-ultra");
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
    const stream = provider.stream(createMockStreamRequest());
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

  it("has correct id, name, and dimensions", () => {
    expect(provider.id).toBe("nvidia");
    expect(provider.name).toBe("NVIDIA NIM Embeddings");
    expect(provider.dimensions).toBe(1536);
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
    });
    const mockProvider2 = createMockProvider({
      getModel: vi.fn().mockReturnValue(undefined),
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
    const chunks: Awaited<ReturnType<typeof router.streamWithFallback>> extends AsyncIterable<
      infer T
    >
      ? T
      : never[] = [];
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
