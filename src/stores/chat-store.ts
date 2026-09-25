import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChatMessage, Citation, ToolResult } from "@/components/chat/types";

interface ChatState {
  // UI State
  isOpen: boolean;
  draft: string;
  isStreaming: boolean;
  currentTool: string | null;
  temporaryError: string | null;

  // Session (anonymous Webi session + conversation — NOT an identity)
  conversationId: string | null;
  sessionId: string | null;

  // Messages (UI representation)
  messages: ChatMessage[];

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  setDraft: (draft: string) => void;
  appendMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (content: string | ((prev: string) => string)) => void;
  setStreaming: (streaming: boolean) => void;
  setCurrentTool: (tool: string | null) => void;
  setTemporaryError: (error: string | null) => void;
  setConversationId: (id: string | null) => void;
  setSessionId: (id: string | null) => void;
  ensureSessionId: () => string;
  clearMessages: () => void;
  reset: () => void;
  incrementMessageCount: () => void;
  getMessageCount: () => number;
}

const MAX_MESSAGES_PER_SESSION = 10;
const MESSAGE_WARNING_THRESHOLD = 0.7;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID shape check shared with the chat hook (server Zod schema rejects the rest with 400). */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function createWebiSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to manual v4 below
  }
  // Manual RFC 4122 v4: ALWAYS uuid-shaped so the server never 400s it,
  // even without crypto.randomUUID (non-secure contexts, old browsers).
  const bytes = new Uint8Array(16);
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(bytes);
    } else {
      throw new Error("no secure RNG");
    }
  } catch {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const initialState = {
  isOpen: false,
  draft: "",
  isStreaming: false,
  currentTool: null,
  temporaryError: null,
  conversationId: null,
  sessionId: null as string | null,
  messages: [] as ChatMessage[],
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      ...initialState,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),

      setDraft: (draft: string) => set({ draft }),

      appendMessage: (msg: ChatMessage) => set((state) => ({ messages: [...state.messages, msg] })),

      updateLastAssistantMessage: (content: string | ((prev: string) => string)) =>
        set((state) => {
          const messages = [...state.messages];
          const lastIdx = messages.findLastIndex((m) => m.role === "assistant");
          if (lastIdx >= 0) {
            const prev = messages[lastIdx].content;
            messages[lastIdx] = {
              ...messages[lastIdx],
              content: typeof content === "function" ? content(prev) : content,
            };
          }
          return { messages };
        }),

      setStreaming: (isStreaming: boolean) => set({ isStreaming }),
      setCurrentTool: (currentTool: string | null) => set({ currentTool }),
      setTemporaryError: (temporaryError: string | null) => set({ temporaryError }),

      setConversationId: (conversationId: string | null) => set({ conversationId }),

      setSessionId: (sessionId: string | null) => set({ sessionId }),

      ensureSessionId: () => {
        const existing = get().sessionId;
        // Self-heal: legacy/corrupt persisted values are rejected by the
        // server (400) forever — regenerate instead of bricking the chat.
        if (isUuid(existing)) return existing;
        const created = createWebiSessionId();
        set({ sessionId: created });
        return created;
      },

      clearMessages: () => set({ messages: [] }),

      reset: () => set(initialState),

      incrementMessageCount: () => {
        // This is a no-op since we count from messages array
        // but kept for API compatibility
      },

      getMessageCount: () => {
        const state = get();
        return state.messages.filter((m) => m.role === "user").length;
      },
    }),
    {
      name: "webxia-chat",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        conversationId: state.conversationId,
        sessionId: state.sessionId,
      }),
    },
  ),
);

export { MAX_MESSAGES_PER_SESSION, MESSAGE_WARNING_THRESHOLD };
