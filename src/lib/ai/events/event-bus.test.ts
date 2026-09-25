import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEventBus, eventBus, type WebiEventMap } from "./event-bus";

describe("event-bus", () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it("delivers a typed envelope (type, ISO timestamp, requestId, payload)", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on("agent.llm.started", handler);

    bus.emit("agent.llm.started", "req-1", { model: "m" });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0];
    expect(event.type).toBe("agent.llm.started");
    expect(event.requestId).toBe("req-1");
    expect(event.payload).toEqual({ model: "m" });
    expect(typeof event.timestamp).toBe("string");
    expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
  });

  it("unsubscribe stops delivery", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const unsub = bus.on("agent.message.received", handler);

    bus.emit("agent.message.received", "r1", { sessionId: "s", role: "user" });
    unsub();
    bus.emit("agent.message.received", "r1", { sessionId: "s", role: "user" });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("once fires a single time", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.once("agent.tool.started", handler);

    bus.emit("agent.tool.started", "r1", { toolName: "t" });
    bus.emit("agent.tool.started", "r1", { toolName: "t" });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("onAny receives every event (system listeners)", () => {
    const bus = createEventBus();
    const seen: string[] = [];
    bus.onAny((event) => {
      seen.push(event.type);
    });

    bus.emit("agent.message.received", "r1", { sessionId: "s", role: "user" });
    bus.emit("agent.llm.completed", "r1", { model: "m", durationMs: 5 });
    bus.emit("agent.error", "r1", { stage: "llm", message: "boom" });

    expect(seen).toEqual(["agent.message.received", "agent.llm.completed", "agent.error"]);
  });

  it("a throwing listener neither blocks others nor the caller, and logs no payload", () => {
    const bus = createEventBus();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const good = vi.fn();
    const bad = vi.fn(() => {
      throw new Error("listener blew up");
    });
    bus.on("agent.error", bad);
    bus.on("agent.error", good);

    expect(() =>
      bus.emit("agent.error", "req-9", { stage: "llm", message: "user content secret" }),
    ).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);

    // Isolation log carries type + requestId only — never user content.
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = consoleSpy.mock.calls[0].map(String).join(" ");
    expect(logged).toContain("agent.error");
    expect(logged).toContain("req-9");
    expect(logged).not.toContain("user content secret");
    consoleSpy.mockRestore();
  });

  it("agent.error listener failure cannot cascade (bus never re-emits)", () => {
    const bus = createEventBus();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;
    bus.on("agent.error", () => {
      calls += 1;
      throw new Error("nope");
    });

    bus.emit("agent.error", "r1", { stage: "chat", message: "x" });

    expect(calls).toBe(1);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("covers every declared event type without payload leakage in types", () => {
    const bus = createEventBus();
    const types = [
      "agent.message.received",
      "agent.context.built",
      "agent.llm.started",
      "agent.llm.completed",
      "agent.tool.started",
      "agent.tool.completed",
      "agent.memory.created",
      "agent.response.completed",
      "agent.error",
    ] as (keyof WebiEventMap)[];
    const received: string[] = [];
    for (const type of types) {
      bus.on(type, () => {
        received.push(type);
      });
    }
    bus.emit("agent.message.received", "r", { sessionId: "s", role: "user" });
    bus.emit("agent.context.built", "r", { sessionId: "s", historyCount: 1, memoryCount: 0 });
    bus.emit("agent.llm.started", "r", { model: "m" });
    bus.emit("agent.llm.completed", "r", { model: "m", durationMs: 1 });
    bus.emit("agent.tool.started", "r", { toolName: "t" });
    bus.emit("agent.tool.completed", "r", { toolName: "t", durationMs: 1, success: true });
    bus.emit("agent.memory.created", "r", { memoryId: "m1" });
    bus.emit("agent.response.completed", "r", { durationMs: 2 });
    bus.emit("agent.error", "r", { stage: "chat", message: "m" });
    expect(received).toHaveLength(9);
  });
});
