import { describe, it, expect, beforeEach, vi } from "vitest";

function createLocalStorageStub() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}

describe("chat-store webi session", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("localStorage", createLocalStorageStub());
    vi.stubGlobal(
      "crypto",
      // crypto.randomUUID may not exist in the test env — the store falls back.
      {},
    );
  });

  it("ensureSessionId creates a stable id (one per visitor, not per message)", async () => {
    const { useChatStore } = await import("./chat-store");
    useChatStore.getState().reset();

    const first = useChatStore.getState().ensureSessionId();
    const second = useChatStore.getState().ensureSessionId();

    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
    expect(second).toBe(first);
  });

  it("setSessionId overrides the stored session id", async () => {
    const { useChatStore } = await import("./chat-store");
    useChatStore.getState().reset();

    useChatStore.getState().setSessionId("00000000-0000-0000-0000-000000000000");
    expect(useChatStore.getState().ensureSessionId()).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("reset clears the session id so the next visit gets a fresh one", async () => {
    const { useChatStore } = await import("./chat-store");
    useChatStore.getState().reset();

    const before = useChatStore.getState().ensureSessionId();
    expect(before).toBeTruthy();

    useChatStore.getState().reset();
    expect(useChatStore.getState().sessionId).toBeNull();
  });

  it("ensureSessionId regenerates when the stored id is not a UUID (self-heal)", async () => {
    const { useChatStore } = await import("./chat-store");
    useChatStore.getState().reset();

    // Legacy or corrupted persisted value: server Zod schema rejects it
    // with 400, bricking the chat forever unless regenerated here.
    useChatStore.getState().setSessionId("not-a-uuid-legacy-value");
    const healed = useChatStore.getState().ensureSessionId();

    expect(healed).not.toBe("not-a-uuid-legacy-value");
    expect(healed).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("ensureSessionId always returns UUID-shaped ids even without crypto.randomUUID", async () => {
    const { useChatStore } = await import("./chat-store");
    useChatStore.getState().reset();

    const id = useChatStore.getState().ensureSessionId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
