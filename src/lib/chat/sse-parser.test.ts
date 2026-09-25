import { describe, it, expect } from "vitest";
import { createSseParser } from "@/lib/chat/sse-parser";

function frame(payload: unknown, id?: number): string {
  const idLine = id === undefined ? "" : `id: ${id}\n`;
  return `${idLine}data: ${JSON.stringify(payload)}\n\n`;
}

const messageStart = {
  type: "message_start",
  data: { messageId: "msg_1" },
  timestamp: 1,
  conversationId: "conv-1",
  requestId: "req-1",
};

const textDelta = {
  type: "text_delta",
  data: { content: "bon", index: 0 },
  timestamp: 2,
  conversationId: "conv-1",
  requestId: "req-1",
};

describe("createSseParser", () => {
  it("parses a frame delivered in a single chunk", () => {
    const parser = createSseParser();
    expect(parser.push(frame(textDelta))).toEqual([textDelta]);
    expect(parser.parseErrors).toBe(0);
  });

  it("reassembles a frame split across arbitrary chunk boundaries", () => {
    const parser = createSseParser();
    const raw = frame(messageStart, 1) + frame(textDelta, 2);
    const events = [];

    for (const char of raw) {
      events.push(...parser.push(char));
    }

    expect(events).toEqual([messageStart, textDelta]);
    expect(parser.lastEventId).toBe("2");
    expect(parser.parseErrors).toBe(0);
  });

  it("returns several events completed by one chunk", () => {
    const parser = createSseParser();
    const events = parser.push(frame(messageStart, 1) + frame(textDelta, 2));
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.type)).toEqual(["message_start", "text_delta"]);
  });

  it("ignores heartbeat comments and exposes the last event id", () => {
    const parser = createSseParser();
    const events = parser.push(`: hb 1700000000000\n\n${frame(textDelta, 7)}`);
    expect(events).toEqual([textDelta]);
    expect(parser.lastEventId).toBe("7");
    expect(parser.parseErrors).toBe(0);
  });

  it("never dispatches before the terminating blank line", () => {
    const parser = createSseParser();
    // Frame header + payload read, but no blank line yet → nothing parsed.
    expect(parser.push(`id: 1\ndata: {"type":"text_delta"}\n`)).toEqual([]);
    expect(parser.parseErrors).toBe(0);
    const events = parser.push(`\n`);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("text_delta");
  });

  it("joins multi-line data of a single event", () => {
    const parser = createSseParser();
    const events = parser.push('data: {"type":"text_delta",\ndata: "content":"x"}\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("text_delta");
    expect(parser.parseErrors).toBe(0);
  });

  it("counts payloads that are not valid JSON instead of throwing", () => {
    const parser = createSseParser();
    expect(parser.push("data: {not json\n\n")).toEqual([]);
    expect(parser.parseErrors).toBe(1);
    // A JSON value that is not an event object is rejected too.
    expect(parser.push("data: 42\n\n")).toEqual([]);
    expect(parser.parseErrors).toBe(2);
  });

  it("tolerates CRLF line endings", () => {
    const parser = createSseParser();
    const events = parser.push(`id: 3\r\ndata: ${JSON.stringify(textDelta)}\r\n\r\n`);
    expect(events).toEqual([textDelta]);
    expect(parser.lastEventId).toBe("3");
  });

  it("end() flushes a trailing event that has no blank line", () => {
    const parser = createSseParser();
    expect(parser.push(frame(textDelta, 4).slice(0, -1))).toEqual([]);
    expect(parser.end()).toEqual([textDelta]);
    expect(parser.parseErrors).toBe(0);
  });

  it("end() drops an incomplete trailing frame without counting an error", () => {
    const parser = createSseParser();
    expect(parser.push(`id: 5\ndata: {"type":"text_del`)).toEqual([]);
    expect(parser.end()).toEqual([]);
    expect(parser.parseErrors).toBe(0);
  });

  it("keeps state across chunks (parser is reusable for a whole stream)", () => {
    const parser = createSseParser();
    const raw = frame(messageStart, 1) + `: hb 1\n\n` + frame(textDelta, 2) + frame(textDelta, 3);
    const events = raw.split("").flatMap((piece) => parser.push(piece));

    expect(events).toHaveLength(3);
    expect(parser.lastEventId).toBe("3");
    expect(parser.parseErrors).toBe(0);
  });
});
