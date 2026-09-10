import { useCallback, useEffect } from "react";
import {
  useChatStore,
  isUuid,
  MAX_MESSAGES_PER_SESSION,
  MESSAGE_WARNING_THRESHOLD,
} from "@/stores/chat-store";
import { toast } from "sonner";
import { useLocale } from "@/lib/locale-context";
import type { TypedStreamEvent } from "@/lib/ai/contracts";
import type { ChatMessage, UseChatReturn } from "@/components/chat/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function useChat(): UseChatReturn {
  const { t, locale } = useLocale();
  const {
    isOpen,
    draft,
    isStreaming,
    currentTool,
    temporaryError,
    messages,
    conversationId,
    open,
    close,
    toggle,
    setDraft,
    appendMessage,
    updateLastAssistantMessage,
    setStreaming,
    setCurrentTool,
    setTemporaryError,
    setConversationId,
    clearMessages,
  } = useChatStore();

  const messageCount = messages.filter((m) => m.role === "user").length;
  const isNearLimit =
    messageCount >= Math.ceil(MAX_MESSAGES_PER_SESSION * MESSAGE_WARNING_THRESHOLD);

  // Initialize conversationId from localStorage on mount and ensure a stable
  // anonymous Webi session id (NOT an identity — server validates ownership).
  useEffect(() => {
    const stored = localStorage.getItem("webxia-conversation-id");
    if (stored && !conversationId) {
      // Never adopt a corrupt persisted id: the server rejects non-UUIDs
      // with 400. Drop it so the server creates a fresh conversation.
      if (isUuid(stored)) {
        setConversationId(stored);
      } else {
        localStorage.removeItem("webxia-conversation-id");
      }
    }
    useChatStore.getState().ensureSessionId();
  }, [conversationId, setConversationId]);

  // Direct store access for surgical message updates (stable reference, no re-render)
  const set = useChatStore.setState;

  const handleStreamEvent = useCallback(
    (event: TypedStreamEvent) => {
      switch (event.type) {
        case "message_start": {
          // Assistant message already created
          break;
        }

        case "text_delta": {
          const content = event.data.content;
          updateLastAssistantMessage((prev) => prev + content);
          break;
        }

        case "tool_start": {
          setCurrentTool(event.data.toolName);
          // Add tool message
          const toolMsg: ChatMessage = {
            id: generateId(),
            role: "tool",
            content: "",
            timestamp: Date.now(),
            toolName: event.data.toolName,
            toolCallId: event.data.toolCallId,
          };
          appendMessage(toolMsg);
          break;
        }

        case "tool_result": {
          // Update the tool message with result
          set((state) => {
            const messages = [...state.messages];
            const lastToolIdx = messages.findLastIndex((m) => m.role === "tool");
            if (lastToolIdx >= 0) {
              messages[lastToolIdx] = {
                ...messages[lastToolIdx],
                content: JSON.stringify(event.data.content),
                toolResult: event.data,
              };
            }
            return { messages };
          });
          break;
        }

        case "citation": {
          // Add citation to last assistant message
          set((state) => {
            const messages = [...state.messages];
            const lastAssistantIdx = messages.findLastIndex((m) => m.role === "assistant");
            if (lastAssistantIdx >= 0) {
              messages[lastAssistantIdx] = {
                ...messages[lastAssistantIdx],
                citations: [...(messages[lastAssistantIdx].citations || []), event.data],
              };
            }
            return { messages };
          });
          break;
        }

        case "message_complete": {
          setConversationId(event.data.conversationId);
          if (!conversationId) {
            localStorage.setItem("webxia-conversation-id", event.data.conversationId);
          }
          // Never leave an empty bubble: when the stream carried no text
          // (LLM failure with server-side fallback), the full content only
          // exists here. Hydrate only an empty assistant message — streamed
          // text is never overwritten.
          if (event.data.fullContent) {
            const fullContent = event.data.fullContent;
            set((state) => {
              const messages = [...state.messages];
              const lastAssistantIdx = messages.findLastIndex((m) => m.role === "assistant");
              if (lastAssistantIdx < 0) return state;
              const last = messages[lastAssistantIdx];
              if (!last.content) {
                messages[lastAssistantIdx] = { ...last, content: fullContent };
              }
              return { messages };
            });
          }
          break;
        }

        case "error": {
          const errorMessage = event.data.message;
          setTemporaryError(errorMessage);
          updateLastAssistantMessage(t("chat.error.generic"));

          if (event.data.code === "PROVIDER_RATE_LIMIT" || event.data.code === "RATE_LIMIT") {
            toast.error(t("chat.error.rate_limit"));
          } else if (event.data.code === "PROVIDER_UNAVAILABLE") {
            toast.error(t("chat.error.unavailable"));
          }
          break;
        }
      }
    },
    [
      conversationId,
      t,
      appendMessage,
      updateLastAssistantMessage,
      setCurrentTool,
      setConversationId,
      setTemporaryError,
      set,
    ],
  );

  const sendMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || isStreaming) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      appendMessage(userMessage);
      setDraft("");
      setStreaming(true);
      setTemporaryError(null);

      // Never fabricate a conversation id: the server creates the
      // conversation and the client adopts the returned id on
      // message_complete. A fabricated id would fail ownership checks.
      // Corrupt values are dropped for the same reason (server 400s them).
      const convId = conversationId && isUuid(conversationId) ? conversationId : null;

      // Create assistant message placeholder
      const assistantMessageId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      appendMessage(assistantMessage);

      try {
        // Stable anonymous Webi session id — created once, persisted in the
        // chat store. Never carries identity (user/role come from Supabase
        // server-side via getSessionUser).
        const sessionId = useChatStore.getState().ensureSessionId();
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message: trimmed,
            // undefined keys are dropped: absent id → server creates.
            conversationId: convId ?? undefined,
            sessionId,
            locale,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6)) as TypedStreamEvent;
                handleStreamEvent(event);
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setTemporaryError(message);

        // Update assistant message with error
        updateLastAssistantMessage(t("chat.error.generic"));

        // Show toast for specific errors
        if (message.includes("429") || message.includes("rate limit")) {
          toast.error(t("chat.error.rate_limit"));
        } else if (message.includes("503") || message.includes("unavailable")) {
          toast.error(t("chat.error.unavailable"));
        }
      } finally {
        setStreaming(false);
        setCurrentTool(null);
      }
    },
    [
      isStreaming,
      conversationId,
      locale,
      t,
      appendMessage,
      updateLastAssistantMessage,
      setDraft,
      setStreaming,
      setCurrentTool,
      setTemporaryError,
      handleStreamEvent,
    ],
  );

  return {
    isOpen,
    draft,
    isStreaming,
    currentTool,
    temporaryError,
    messages,
    conversationId,
    messageCount,
    maxMessages: MAX_MESSAGES_PER_SESSION,
    isNearLimit,
    open,
    close,
    toggle,
    setDraft,
    sendMessage,
    resetConversation: useCallback(() => {
      clearMessages();
      setConversationId(null);
      localStorage.removeItem("webxia-conversation-id");
    }, [clearMessages, setConversationId]),
  };
}

export function useChatStoreActions() {
  const { sendMessage, ...rest } = useChat();
  return { sendMessage, ...rest };
}
