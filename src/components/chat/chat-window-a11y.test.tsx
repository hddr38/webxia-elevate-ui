import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-context";
import { ChatWindow } from "./ChatWindow";

/**
 * CHAT-2 (correction A1) — annonce accessible de l'échec chat.
 *
 * Verrouille que la bannière d'erreur de ChatWindow expose `role="alert"`
 * (le primitif shadcn Alert l'injecte déjà ; le call-site le déclare
 * explicitement pour survivre à un refactor du primitif) et que la région
 * live existante (role="log" / role="status") n'est pas détériorée.
 *
 * Environnement node : use-chat / use-sticky-scroll / Link mockés (stack
 * lourd hors périmètre — zustand + server functions non requis ici).
 */

vi.mock("@/hooks/use-chat", () => ({
  useChat: () => ({
    isOpen: true,
    draft: "",
    isStreaming: false,
    currentTool: null,
    temporaryError: "Rate limit exceeded",
    errorCode: null,
    canRetry: false,
    messages: [
      { id: "u1", role: "user", content: "Bonjour", timestamp: 1 },
      { id: "a1", role: "assistant", content: "Réponse", timestamp: 2 },
    ],
    conversationId: null,
    messageCount: 1,
    maxMessages: 10,
    isNearLimit: false,
    close: vi.fn(),
    toggle: vi.fn(),
    open: vi.fn(),
    setDraft: vi.fn(),
    sendMessage: vi.fn(),
    stopStreaming: vi.fn(),
    retryLastMessage: vi.fn(),
    resetConversation: vi.fn(),
  }),
  abortActiveStream: vi.fn(),
}));

vi.mock("@/hooks/use-sticky-scroll", () => ({
  useStickyScroll: () => ({
    containerRef: { current: null },
    isSticky: true,
    forceScrollToBottom: vi.fn(),
    notifyMessageComplete: vi.fn(),
    notifyStreamingTick: vi.fn(),
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

function renderWindow(): string {
  return renderToStaticMarkup(
    <LocaleProvider>
      <ChatWindow />
    </LocaleProvider>,
  );
}

describe("ChatWindow — A1 annonce accessible de l'échec (CHAT-2)", () => {
  it('la bannière d\'erreur porte role="alert"', () => {
    const html = renderWindow();
    expect(html).toContain('role="alert"');
    // Une seule alerte montée (transcript court → pas de alerte limite).
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    // Le contenu de l'erreur est présent dans l'alerte.
    expect(html).toContain("Rate limit exceeded");
  });

  it("les régions live existantes sont conservées (log + status)", () => {
    const html = renderWindow();
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="false"');
  });

  it("le transcript rend les bulles user/assistant sans chip de statut (messages confirmés)", () => {
    const html = renderWindow();
    expect(html).toContain("Bonjour");
    expect(html).toContain("Réponse");
    expect(html).not.toContain("Envoi…");
    expect(html).not.toContain("Échec");
  });
});
