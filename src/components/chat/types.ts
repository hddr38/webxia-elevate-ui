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
}

export interface UseChatReturn {
  isOpen: boolean;
  draft: string;
  isStreaming: boolean;
  currentTool: string | null;
  temporaryError: string | null;
  messages: ChatMessage[];
  conversationId: string | null;
  messageCount: number;
  maxMessages: number;
  isNearLimit: boolean;

  open: () => void;
  close: () => void;
  toggle: () => void;
  setDraft: (draft: string) => void;
  sendMessage: (message: string) => Promise<void>;
  resetConversation: () => void;
}
