import type { TypedStreamEvent } from "@/lib/ai/contracts";

/**
 * Incremental SSE reader for the Webi chat stream (LOT 23).
 *
 * Extracted from the chat hook so it can be unit-tested in a plain node
 * environment (the repo ships no jsdom/testing-library). It implements the
 * parts of the SSE grammar the server actually uses:
 *
 * - `id: <n>`        → sequence marker, exposed on `lastEventId`
 * - `data: <json>`   → one payload per event (multi-line data is joined)
 * - `: <comment>`    → heartbeat/keep-alive, ignored
 * - anything else    → ignored (`event:`, `retry:`, unknown fields)
 *
 * Events are dispatched on the blank line that terminates an SSE event, so a
 * frame split across network chunks is never lost or double-parsed. CRLF line
 * endings are tolerated.
 */
export interface SseParser {
  /** Feed decoded text; returns the events completed by this chunk. */
  push(text: string): TypedStreamEvent[];
  /** Flush a trailing event that arrived without its terminating blank line. */
  end(): TypedStreamEvent[];
  /** Last `id:` seen — the cursor a reconnection would resume from. */
  readonly lastEventId: string | null;
  /** Number of `data:` payloads that were not valid JSON (surfaced in tests). */
  readonly parseErrors: number;
}

function stripCr(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

export function createSseParser(): SseParser {
  let buffer = "";
  let dataLines: string[] = [];
  let lastEventId: string | null = null;
  let parseErrors = 0;

  const dispatch = (): TypedStreamEvent | null => {
    if (dataLines.length === 0) return null;
    const raw = dataLines.join("\n");
    dataLines = [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
        parseErrors++;
        return null;
      }
      return parsed as TypedStreamEvent;
    } catch {
      parseErrors++;
      return null;
    }
  };

  const feedLine = (line: string): TypedStreamEvent | null => {
    if (line === "") return dispatch();
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
      return null;
    }
    if (line.startsWith("id:")) {
      lastEventId = line.slice(3).replace(/^ /, "");
      return null;
    }
    // Comments (heartbeat), event:, retry: and unknown fields carry nothing
    // for the client — deliberately ignored.
    return null;
  };

  return {
    get lastEventId(): string | null {
      return lastEventId;
    },
    get parseErrors(): number {
      return parseErrors;
    },
    push(text: string): TypedStreamEvent[] {
      buffer += text;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      const events: TypedStreamEvent[] = [];
      for (const line of lines) {
        const event = feedLine(stripCr(line));
        if (event) events.push(event);
      }
      return events;
    },
    end(): TypedStreamEvent[] {
      const events: TypedStreamEvent[] = [];
      // A trailing line without its newline can only be an incomplete frame —
      // drop it, but still flush data lines that were already complete.
      buffer = "";
      const event = dispatch();
      if (event) events.push(event);
      return events;
    },
  };
}
