import type { Citation, ToolResult } from "@/lib/ai/contracts";

export type {
  TypedStreamEvent,
  ToolResult,
  Citation,
  ToolCall,
  TokenUsage,
} from "@/lib/ai/contracts";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  toolName?: string;
  toolCallId?: string;
  citations?: Citation[];
  toolResult?: ToolResult;
  /**
   * CHAT-2 — transient delivery status of a USER message (client-only).
   * "pending": appended optimistically, not yet confirmed by `message_start`.
   * "failed":  pre-stream HTTP/network failure — the bubble stays, retryable.
   * Absent (including every restored/history message) = confirmed.
   * Never persisted (store `partialize` saves only conversation/session ids)
   * and never sent to the server.
   */
  status?: "pending" | "failed";
}

export interface UseChatReturn {
  isOpen: boolean;
  draft: string;
  isStreaming: boolean;
  currentTool: string | null;
  temporaryError: string | null;
  /** SSE error code of the last failed stream (null for client/network errors). */
  errorCode: string | null;
  /** Server says the failed attempt is worth retrying (error.recoverable). */
  canRetry: boolean;
  messages: ChatMessage[];
  conversationId: string | null;
  messageCount: number;
  maxMessages: number;
  isNearLimit: boolean;

  open: () => void;
  close: () => void;
  toggle: () => void;
  setDraft: (draft: string) => void;
  sendMessage: (message: string, options?: { isRetry?: boolean }) => Promise<void>;
  /** Cancel the in-flight stream (server aborts the LLM call too). */
  stopStreaming: () => void;
  /** Replay the last user message without duplicating it server-side. */
  retryLastMessage: () => Promise<void>;
  resetConversation: () => void;
}
