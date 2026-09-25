import { useCallback, useEffect, useRef, useState } from "react";
import {
  useChatStore,
  isUuid,
  MAX_MESSAGES_PER_SESSION,
  MESSAGE_WARNING_THRESHOLD,
} from "@/stores/chat-store";
import { toast } from "sonner";
import { useLocale } from "@/lib/locale-context";
import { createSseParser } from "@/lib/chat/sse-parser";
import type { TypedStreamEvent } from "@/lib/ai/contracts";
import type { ChatMessage, UseChatReturn } from "@/components/chat/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * In-flight chat request, module-scoped on purpose: closing the widget
 * (Escape) or unmounting it must be able to cancel a request started by a
 * component that is about to disappear, otherwise the server keeps generating
 * for a client that is no longer reading (LOT 23).
 */
let activeAbort: AbortController | null = null;

export function abortActiveStream(): void {
  activeAbort?.abort();
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "AbortError"
  );
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

  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const lastUserMessageRef = useRef<string | null>(null);

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
          // Adopt the server-assigned conversation as soon as the stream opens:
          // it is the only way a failed attempt can be retried without creating
          // a second conversation (message_complete never arrives on failure).
          const cid = event.conversationId;
          if (isUuid(cid) && cid !== conversationId) {
            setConversationId(cid);
            localStorage.setItem("webxia-conversation-id", cid);
          }
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
          const code = event.data.code;
          setErrorCode(code);
          // `recoverable` is the server's own verdict on whether a retry makes
          // sense — GENERATION_FAILED and GLOBAL_TIMEOUT both send true.
          setCanRetry(event.data.recoverable);

          if (code === "GENERATION_FAILED") {
            setTemporaryError(t("chat.error.generation"));
          } else if (code === "GLOBAL_TIMEOUT") {
            setTemporaryError(t("chat.error.timeout"));
          } else {
            setTemporaryError(event.data.message);
          }
          // Keep whatever already streamed — the alert below carries the error.
          updateLastAssistantMessage((prev) =>
            prev.trim().length > 0 ? prev : t("chat.error.generic"),
          );

          if (code === "PROVIDER_RATE_LIMIT" || code === "RATE_LIMIT") {
            toast.error(t("chat.error.rate_limit"));
          } else if (code === "PROVIDER_UNAVAILABLE") {
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
    async (message: string, options?: { isRetry?: boolean }) => {
      const isRetry = options?.isRetry === true;
      const trimmed = message.trim();
      if (!trimmed || isStreaming) return;

      setStreaming(true);
      setTemporaryError(null);
      setErrorCode(null);
      setCanRetry(false);
      lastUserMessageRef.current = trimmed;
      // A retry replays the stored message — never touch what the user is typing.
      if (!isRetry) setDraft("");

      if (!isRetry) {
        appendMessage({
          id: generateId(),
          role: "user",
          content: trimmed,
          timestamp: Date.now(),
        });
      } else {
        // Drop the failed attempt's placeholder so the retry replaces it
        // instead of stacking an error bubble in the transcript.
        const state = useChatStore.getState();
        const last = state.messages[state.messages.length - 1];
        if (last?.role === "assistant") {
          useChatStore.setState({ messages: state.messages.slice(0, -1) });
        }
      }

      // Never fabricate a conversation id: the server creates the
      // conversation and the client adopts the returned id on
      // message_start / message_complete. A fabricated id would fail
      // ownership checks. Corrupt values are dropped for the same reason.
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

      const controller = new AbortController();
      activeAbort = controller;

      try {
        // Stable anonymous Webi session id — created once, persisted in the
        // chat store. Never carries identity (user/role come from Supabase
        // server-side via getSessionUser).
        const sessionId = useChatStore.getState().ensureSessionId();
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            message: trimmed,
            // undefined keys are dropped: absent id → server creates.
            conversationId: convId ?? undefined,
            sessionId,
            locale,
            // Server skips the duplicate user write when retrying a message
            // that already lives in the known conversation.
            isRetry: isRetry || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        const parser = createSseParser();
        const drain = (events: TypedStreamEvent[]) => {
          for (const event of events) handleStreamEvent(event);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          drain(parser.push(decoder.decode(value, { stream: true })));
        }
        drain(parser.push(decoder.decode()));
        drain(parser.end());
      } catch (error) {
        if (isAbortError(error)) {
          // User-initiated stop (or widget closed): keep what was streamed and
          // stay silent — no error banner for a deliberate cancellation.
          updateLastAssistantMessage((prev) =>
            prev.trim().length > 0 ? prev : t("chat.error.stopped"),
          );
        } else {
          const message = error instanceof Error ? error.message : "Unknown error";
          setTemporaryError(message);
          setErrorCode(null);

          // Update assistant message with error
          updateLastAssistantMessage((prev) =>
            prev.trim().length > 0 ? prev : t("chat.error.generic"),
          );

          // Show toast for specific errors
          if (message.includes("429") || message.includes("rate limit")) {
            toast.error(t("chat.error.rate_limit"));
          } else if (message.includes("503") || message.includes("unavailable")) {
            toast.error(t("chat.error.unavailable"));
          }
        }
      } finally {
        if (activeAbort === controller) activeAbort = null;
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

  const stopStreaming = useCallback(() => {
    abortActiveStream();
  }, []);

  const retryLastMessage = useCallback(async () => {
    const target = lastUserMessageRef.current;
    if (!target || isStreaming) return;
    await sendMessage(target, { isRetry: true });
  }, [isStreaming, sendMessage]);

  return {
    isOpen,
    draft,
    isStreaming,
    currentTool,
    temporaryError,
    errorCode,
    canRetry,
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
    stopStreaming,
    retryLastMessage,
    resetConversation: useCallback(() => {
      abortActiveStream();
      clearMessages();
      setConversationId(null);
      lastUserMessageRef.current = null;
      setErrorCode(null);
      setCanRetry(false);
      localStorage.removeItem("webxia-conversation-id");
    }, [clearMessages, setConversationId]),
  };
}

export function useChatStoreActions() {
  const { sendMessage, ...rest } = useChat();
  return { sendMessage, rest };
}
