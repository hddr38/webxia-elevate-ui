import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-context";
import { ChatMessage } from "@/components/chat/ChatMessage";

/** Wrapper that provides a real locale context for the component under test. */
function renderChatMessage(
  message: Parameters<typeof ChatMessage>[0]["message"],
  options: { isLast?: boolean; isStreaming?: boolean } = {},
): string {
  return renderToStaticMarkup(
    <LocaleProvider>
      <ChatMessage
        message={message}
        isLast={options.isLast ?? true}
        isStreaming={options.isStreaming ?? false}
      />
    </LocaleProvider>,
  );
}

describe("ChatMessage", () => {
  const baseMessage = { id: "m-1", role: "user" as const, content: "Hello", timestamp: 123 };

  it("renders user message with content and right alignment", () => {
    const html = renderChatMessage({ ...baseMessage, role: "user", content: "Hello world" });
    expect(html).toContain("Hello world");
    expect(html).toContain("justify-end");
    expect(html).not.toContain("MarkdownContent"); // user messages bypass markdown
  });

  it("renders assistant message through MarkdownContent", () => {
    const html = renderChatMessage({
      ...baseMessage,
      role: "assistant",
      content: "**Bold** and `code`",
    });
    expect(html).toContain('<strong class="font-semibold">Bold</strong>'); // markdown rendered
    expect(html).toContain("<code"); // inline code
    expect(html).toContain("justify-start");
  });

  it("renders streaming caret when isLast + isStreaming + assistant", () => {
    const html = renderChatMessage(
      { ...baseMessage, role: "assistant", content: "Partial" },
      { isLast: true, isStreaming: true },
    );
    expect(html).toContain("animate-pulse");
    expect(html).toContain("bg-brand");
  });

  it("does NOT show caret when not streaming or not last", () => {
    const html1 = renderChatMessage(
      { ...baseMessage, role: "assistant", content: "Done" },
      { isLast: true, isStreaming: false },
    );
    expect(html1).not.toContain("animate-pulse");

    const html2 = renderChatMessage(
      { ...baseMessage, role: "assistant", content: "Partial" },
      { isLast: false, isStreaming: true },
    );
    expect(html2).not.toContain("animate-pulse");
  });

  it("shows copy-response button on last assistant message when NOT streaming", () => {
    const html = renderChatMessage(
      { ...baseMessage, role: "assistant", content: "Copy me" },
      { isLast: true, isStreaming: false },
    );
    expect(html).toContain("Copier la réponse");
    expect(html).toContain("Copier");
  });

  it("hides copy-response button during streaming or non-last", () => {
    const html1 = renderChatMessage(
      { ...baseMessage, role: "assistant", content: "Streaming" },
      { isLast: true, isStreaming: true },
    );
    expect(html1).not.toContain("Copier la réponse");

    const html2 = renderChatMessage(
      { ...baseMessage, role: "assistant", content: "Not last" },
      { isLast: false, isStreaming: false },
    );
    expect(html2).not.toContain("Copier la réponse");
  });

  it("renders tool message with toolName and content", () => {
    const html = renderChatMessage({
      ...baseMessage,
      role: "tool",
      content: "result data",
      toolName: "search_knowledge",
      toolCallId: "call-1",
    });
    expect(html).toContain("search_knowledge");
    expect(html).toContain("result data");
    expect(html).toContain("bg-brand");
  });

  // Citations UI uses useState/AnimatePresence → not testable via renderToStaticMarkup.
  // Verified in E2E (Prompt 9).

  it("renders toolResult when present", () => {
    const html = renderChatMessage({
      ...baseMessage,
      role: "assistant",
      content: "Result",
      toolResult: {
        content: "tool output",
        toolCallId: "call-1",
        toolName: "search",
        success: true,
      },
    });
    expect(html).toContain("tool output");
    // Apostrophe is HTML-escaped in static markup; match the text prefix.
    expect(html).toContain("Résultat de l");
  });
});

/**
 * CHAT-2 — statut optimiste du message utilisateur.
 * Locale par défaut du provider = FR (état initial useState ; les effets ne
 * tournent pas en renderToStaticMarkup) → libellés FR assertés au rendu,
 * libellés EN assertés sur le dictionnaire (parité stricte FR/EN).
 */
describe("ChatMessage statut optimiste (CHAT-2)", () => {
  const userMessage = { id: "u-1", role: "user" as const, content: "Bonjour", timestamp: 1 };

  function renderUser(status: "pending" | "failed" | undefined, onRetry?: () => void): string {
    return renderToStaticMarkup(
      <LocaleProvider>
        <ChatMessage
          message={{ ...userMessage, ...(status ? { status } : {}) }}
          isLast={true}
          isStreaming={false}
          onRetry={onRetry}
        />
      </LocaleProvider>,
    );
  }

  it("pending : chip « Envoi… » discrète, sans bouton Réessayer", () => {
    const html = renderUser("pending");
    expect(html).toContain("Envoi…");
    expect(html).toContain("text-primary-foreground/70");
    expect(html).not.toContain("Réessayer");
    expect(html).not.toContain("Échec");
    expect(html).toContain("Bonjour"); // le contenu reste visible
  });

  it("failed : état « Échec » + bouton « Réessayer » qui appelle onRetry", () => {
    const onRetry = vi.fn();
    const html = renderUser("failed", onRetry);
    expect(html).toContain("Échec");
    expect(html).toContain("Réessayer");
    expect(html).not.toContain("Envoi…");
    // Le bouton est un vrai bouton activable.
    expect(html).toMatch(/<button[^>]*>[\s\S]*?Réessayer/);
  });

  it("failed sans onRetry : « Échec » sans bouton (defensive)", () => {
    const html = renderUser("failed");
    expect(html).toContain("Échec");
    expect(html).not.toContain("Réessayer");
  });

  it("confirmé (statut absent) : aucun chip, aucun bouton", () => {
    const html = renderUser(undefined);
    expect(html).not.toContain("Envoi…");
    expect(html).not.toContain("Échec");
    expect(html).not.toContain("Réessayer");
    expect(html).toContain("Bonjour");
  });

  it("assistant : un éventuel statut fuitant n'affiche JAMAIS de chip (garde isUser)", () => {
    const html = renderToStaticMarkup(
      <LocaleProvider>
        <ChatMessage
          message={{
            id: "a-1",
            role: "assistant",
            content: "Réponse",
            timestamp: 1,
            status: "failed",
          }}
          isLast={true}
          isStreaming={false}
        />
      </LocaleProvider>,
    );
    expect(html).not.toContain("Envoi…");
    expect(html).not.toContain("Échec");
    expect(html).not.toContain("Réessayer");
  });

  it("parité i18n FR/EN des clés de statut (+ chat.retry réutilisée)", async () => {
    const { translations } = await import("@/lib/locale-context");
    expect(translations.fr["chat.status.sending"]).toBe("Envoi…");
    expect(translations.fr["chat.status.failed"]).toBe("Échec");
    expect(translations.fr["chat.retry"]).toBe("Réessayer");
    expect(translations.en["chat.status.sending"]).toBe("Sending…");
    expect(translations.en["chat.status.failed"]).toBe("Failed");
    expect(translations.en["chat.retry"]).toBe("Retry");
    // Parité stricte sur le trio de clés du lot.
    for (const key of ["chat.status.sending", "chat.status.failed", "chat.retry"]) {
      expect(translations.fr[key]).toBeDefined();
      expect(translations.en[key]).toBeDefined();
    }
  });
});
