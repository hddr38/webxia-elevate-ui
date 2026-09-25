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
