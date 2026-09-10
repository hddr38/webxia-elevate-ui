import { describe, it, expect, vi, afterEach } from "vitest";
import { NvidiaProvider } from "../providers/nvidia";
import type { ProviderRequest } from "../contracts";
import type { Message } from "../contracts";
import { createMockToolDefinition } from "./test-utils";

/**
 * Regression suite for the RAG critical fix: ProviderRequest.systemPrompt
 * MUST reach the NVIDIA HTTP payload as messages[0] ({ role: "system" }).
 * Previously buildRequest() silently dropped it, so the LLM answered with
 * no Webi identity and no KNOWLEDGE while citations still displayed.
 */

function userMessage(content: string): Message {
  return { id: "u1", role: "user", content, timestamp: 1 };
}

function completionResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 1,
      model: "nvidia/nemotron-3-ultra-550b-a55b",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
    { status: 200 },
  );
}

function streamResponse(): Response {
  const first = JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 1,
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    choices: [{ index: 0, delta: { role: "assistant", content: "ok" }, finish_reason: null }],
  });
  const last = JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 1,
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
  return new Response(`data: ${first}\n\ndata: ${last}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

interface CapturedBody {
  model: string;
  messages: Array<{ role: string; content: string | null }>;
  tools?: unknown;
  tool_choice?: unknown;
  chat_template_kwargs?: { enable_thinking: boolean };
}

function capturedBody(fetchMock: ReturnType<typeof vi.fn>): CapturedBody {
  const init = fetchMock.mock.calls[0][1] as { body: string };
  return JSON.parse(String(init.body)) as CapturedBody;
}

async function initProvider(): Promise<NvidiaProvider> {
  const provider = new NvidiaProvider();
  await provider.initialize({
    apiKey: "test-key",
    baseUrl: "https://test.api/v1",
    timeout: 30000,
    maxRetries: 2,
  });
  return provider;
}

describe("NvidiaProvider system prompt transmission", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prepends request.systemPrompt as messages[0] on complete()", async () => {
    const provider = await initProvider();
    const fetchMock = vi.fn().mockResolvedValue(completionResponse("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const request: ProviderRequest = {
      model: "nvidia/nemotron-3-ultra-550b-a55b",
      messages: [userMessage("USER TEST")],
      systemPrompt: "SYSTEM TEST",
    };
    await provider.complete(request);

    const body = capturedBody(fetchMock);
    expect(body.messages[0]).toEqual({ role: "system", content: "SYSTEM TEST" });
    expect(body.messages[1]).toEqual({ role: "user", content: "USER TEST" });
  });

  it("prepends request.systemPrompt as messages[0] on stream()", async () => {
    const provider = await initProvider();
    const fetchMock = vi.fn().mockResolvedValue(streamResponse());
    vi.stubGlobal("fetch", fetchMock);

    const request: ProviderRequest = {
      model: "nvidia/nemotron-3-ultra-550b-a55b",
      messages: [userMessage("USER TEST")],
      systemPrompt: "SYSTEM TEST",
      stream: true,
    };
    const chunks = [];
    for await (const chunk of provider.stream(request)) {
      chunks.push(chunk);
    }

    const body = capturedBody(fetchMock);
    expect(body.messages[0]).toEqual({ role: "system", content: "SYSTEM TEST" });
    expect(body.messages[1]).toEqual({ role: "user", content: "USER TEST" });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("sends no system message when systemPrompt is undefined", async () => {
    const provider = await initProvider();
    const fetchMock = vi.fn().mockResolvedValue(completionResponse("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await provider.complete({
      model: "m",
      messages: [userMessage("USER TEST")],
    });

    const body = capturedBody(fetchMock);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toEqual({ role: "user", content: "USER TEST" });
  });

  it("sends no system message when systemPrompt is blank", async () => {
    const provider = await initProvider();
    const fetchMock = vi.fn().mockResolvedValue(completionResponse("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await provider.complete({
      model: "m",
      messages: [userMessage("USER TEST")],
      systemPrompt: "   ",
    });

    const body = capturedBody(fetchMock);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]?.role).toBe("user");
  });

  it("preserves history, tool calls and tools when prepending system", async () => {
    const provider = await initProvider();
    const fetchMock = vi.fn().mockResolvedValue(completionResponse("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const history: Message[] = [
      { id: "h1", role: "user", content: "Hello", timestamp: 1 },
      { id: "h2", role: "assistant", content: "Hi!", timestamp: 2 },
      { id: "h3", role: "user", content: "Question?", timestamp: 3 },
    ];
    const tools = [createMockToolDefinition()];
    await provider.complete({
      model: "m",
      messages: history,
      systemPrompt: "SYSTEM TEST",
      tools,
    });

    const body = capturedBody(fetchMock);
    expect(body.messages).toHaveLength(4);
    expect(body.messages[0]).toEqual({ role: "system", content: "SYSTEM TEST" });
    expect(body.messages.slice(1).map((m) => m.content)).toEqual(["Hello", "Hi!", "Question?"]);
    expect(body.messages.slice(1).map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toBe("auto");
  });

  it("disables thinking via chat_template_kwargs (fast TTFB, no silent reasoning)", async () => {
    const provider = await initProvider();
    const fetchMock = vi.fn().mockResolvedValue(completionResponse("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await provider.complete({
      model: "nvidia/nemotron-3.5-lightning-30b-a3b",
      messages: [userMessage("Hello")],
      systemPrompt: "SYSTEM TEST",
    });

    const body = capturedBody(fetchMock);
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("registers lightning (primary) and super (fallback) with thinking gated per model", async () => {
    const provider = await initProvider();

    expect(provider.getModel("nvidia/nemotron-3.5-lightning-30b-a3b")?.capabilities.thinking).toBe(
      true,
    );
    expect(
      provider.getModel("nvidia/nemotron-3-super-120b-a12b")?.capabilities.thinking,
    ).toBeUndefined();
  });

  it.each(["nvidia/nemotron-3-super-120b-a12b", "llama-3.1-8b-instruct", "some-unknown-model"])(
    "omits chat_template_kwargs for non-reasoning model %s",
    async (model) => {
      const provider = await initProvider();
      const fetchMock = vi.fn().mockResolvedValue(completionResponse("ok"));
      vi.stubGlobal("fetch", fetchMock);

      await provider.complete({
        model,
        messages: [userMessage("Hello")],
        systemPrompt: "SYSTEM TEST",
      });

      const body = capturedBody(fetchMock);
      expect("chat_template_kwargs" in body).toBe(false);
      // System prompt still transmitted regardless of thinking support.
      expect(body.messages[0]).toEqual({ role: "system", content: "SYSTEM TEST" });
    },
  );

  it("counts reasoning deltas without rendering them, and survives delta-less chunks", async () => {
    const provider = await initProvider();
    const reasoning = JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1,
      model: "m",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", reasoning_content: "let me think" },
          finish_reason: null,
        },
      ],
    });
    const noDelta = JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1,
      model: "m",
      choices: [{ index: 0, finish_reason: null }],
    });
    const text = JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1,
      model: "m",
      choices: [{ index: 0, delta: { content: "ok" }, finish_reason: null }],
    });
    const last = JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 1,
      model: "m",
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `data: ${reasoning}\n\ndata: ${noDelta}\n\ndata: ${text}\n\ndata: ${last}\n\n`,
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        ),
      ),
    );

    const seen: string[] = [];
    let doneReasoning: number | undefined;
    for await (const chunk of provider.stream({
      model: "m",
      messages: [userMessage("Hello")],
      stream: true,
    })) {
      if (chunk.type === "chunk" && chunk.content) seen.push(chunk.content);
      if (chunk.type === "done") doneReasoning = chunk.reasoningChunks;
    }

    // Reasoning never leaks into answer text, but is accounted for.
    expect(seen).toEqual(["ok"]);
    expect(doneReasoning).toBe(1);
  });
});
