import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider, translations } from "@/lib/locale-context";
import { ChatWindow } from "./ChatWindow";

/**
 * CHAT-2 (correction A1) — annonce accessible de l'échec chat.
 *
 * Verrouille que la bannière d'erreur de ChatWindow expose `role="alert"`
 * (le primitif shadcn Alert l'injecte déjà ; le call-site le déclare
 * explicitement pour survivre à un refactor du primitif) et que la région
 * live existante (role="log" / role="status") n'est pas détériorée.
 *
 * CHAT-3 (correction A2) — annonce accessible de l'état outil.
 *
 * Verrouille que la région sr-only `role="status"` annonce « Outil en cours
 * d'exécution » pendant tool_start, puis « Résultat de l'outil » une fois le
 * tool_result posé sur la bulle outil, sans faux « Résultat… » pendant
 * l'exécution, avec parité FR/EN et sans régression du rendu visible
 * ToolStatus / streaming / statut optimiste.
 *
 * Environnement node : use-chat / use-sticky-scroll / Link mockés (stack
 * lourd hors périmètre — zustand + server functions non requis ici).
 */

interface MockMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  toolName?: string;
  toolCallId?: string;
  toolResult?: { content: unknown };
  status?: "pending" | "failed";
}

// État mutable piloté par test (vi.hoisted : la factory vi.mock est hoistée
// au-dessus des déclarations de module).
const { chatState } = vi.hoisted(() => ({
  chatState: {
    isStreaming: false,
    currentTool: null as string | null,
    temporaryError: "Rate limit exceeded" as string | null,
    messages: [] as Array<{
      id: string;
      role: "user" | "assistant" | "tool";
      content: string;
      timestamp: number;
      toolName?: string;
      toolCallId?: string;
      toolResult?: { content: unknown };
      status?: "pending" | "failed";
    }>,
  },
}));

vi.mock("@/hooks/use-chat", () => ({
  useChat: () => ({
    isOpen: true,
    draft: "",
    isStreaming: chatState.isStreaming,
    currentTool: chatState.currentTool,
    temporaryError: chatState.temporaryError,
    errorCode: null,
    canRetry: false,
    messages: chatState.messages,
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

/** Texte de la région sr-only role="status" de ChatWindow (unique dans le DOM). */
function srStatusText(html: string): string | undefined {
  const raw = html.match(
    /<div role="status" aria-live="polite" class="sr-only">([^<]*)<\/div>/,
  )?.[1];
  if (raw === undefined) return undefined;
  // renderToStaticMarkup échappe les apostrophes (&#x27;) comme le fait le
  // navigateur : on décode pour comparer aux libellés du dictionnaire.
  return raw
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const USER_MSG: MockMessage = { id: "u1", role: "user", content: "Bonjour", timestamp: 1 };
const ASSISTANT_MSG: MockMessage = { id: "a1", role: "assistant", content: "", timestamp: 2 };

describe("ChatWindow — A1 annonce accessible de l'échec (CHAT-2)", () => {
  beforeEach(() => {
    chatState.isStreaming = false;
    chatState.currentTool = null;
    chatState.temporaryError = "Rate limit exceeded";
    chatState.messages = [
      USER_MSG,
      { id: "a1", role: "assistant", content: "Réponse", timestamp: 2 },
    ];
  });

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

describe("ChatWindow — A2 annonce accessible de l'état outil (CHAT-3)", () => {
  beforeEach(() => {
    chatState.isStreaming = false;
    chatState.currentTool = null;
    chatState.temporaryError = null;
    chatState.messages = [USER_MSG, ASSISTANT_MSG];
  });

  it("pendant tool_start : la région sr-only annonce l'état en cours, jamais le résultat", () => {
    chatState.isStreaming = true;
    chatState.currentTool = "search_knowledge";
    chatState.messages = [
      USER_MSG,
      ASSISTANT_MSG,
      {
        id: "t1",
        role: "tool",
        content: "",
        timestamp: 3,
        toolName: "search_knowledge",
        toolCallId: "call-1",
        // tool_result non reçu : pas de champ toolResult.
      },
    ];
    const html = renderWindow();
    expect(srStatusText(html)).toBe("Outil en cours d'exécution");
    // Aucun faux « Résultat… » pendant l'exécution : région sr-only ET forme
    // échappée dans le HTML (la bulle tool n'affiche jamais chat.tool.result).
    expect(srStatusText(html)).not.toContain("Résultat de l'outil");
    expect(html).not.toContain("Résultat de l&#x27;outil");
  });

  it("après tool_result : la région sr-only annonce le résultat, plus l'état en cours", () => {
    chatState.isStreaming = true;
    chatState.currentTool = "search_knowledge";
    chatState.messages = [
      USER_MSG,
      ASSISTANT_MSG,
      {
        id: "t1",
        role: "tool",
        content: "[]",
        timestamp: 3,
        toolName: "search_knowledge",
        toolCallId: "call-1",
        toolResult: { content: [] },
      },
    ];
    const html = renderWindow();
    expect(srStatusText(html)).toBe("Résultat de l'outil");
    expect(srStatusText(html)).not.toContain("Outil en cours d'exécution");
  });

  it("pendant le streaming sans outil : la région sr-only annonce l'écriture (non-régression)", () => {
    chatState.isStreaming = true;
    chatState.currentTool = null;
    const html = renderWindow();
    expect(srStatusText(html)).toBe("Webi écrit.");
  });

  it("flux terminé : la région sr-only est vide (non-régression)", () => {
    chatState.isStreaming = false;
    chatState.currentTool = null;
    const html = renderWindow();
    expect(srStatusText(html)).toBe("");
    expect(html).toContain('role="status"');
  });

  it("i18n : libellés FR/EN de chat.tool.running et chat.tool.result présents et non vides", () => {
    expect(translations.fr["chat.tool.running"]).toBe("Outil en cours d'exécution");
    expect(translations.en["chat.tool.running"]).toBe("Tool running");
    expect(translations.fr["chat.tool.result"]).toBe("Résultat de l'outil");
    expect(translations.en["chat.tool.result"]).toBe("Tool result");
    // Parité stricte : les 4 valeurs existent et sont non vides.
    for (const dict of [translations.fr, translations.en]) {
      for (const key of ["chat.tool.running", "chat.tool.result"] as const) {
        expect(dict[key]).toBeTruthy();
      }
    }
  });

  it("non-régression : ToolStatus visible, streaming et statut optimiste intacts pendant l'outil", () => {
    chatState.isStreaming = true;
    chatState.currentTool = "search_knowledge";
    chatState.messages = [
      { ...USER_MSG, status: "pending" },
      ASSISTANT_MSG,
      {
        id: "t1",
        role: "tool",
        content: "",
        timestamp: 3,
        toolName: "search_knowledge",
        toolCallId: "call-1",
      },
    ];
    const html = renderWindow();
    // Annonce sr-only correcte.
    expect(srStatusText(html)).toBe("Outil en cours d'exécution");
    // ToolStatus visible inchangé (libellé whiteliste + fallback non touchés).
    expect(html).toContain("Webi recherche dans ses connaissances…");
    // Statut optimiste inchangé : la chip « Envoi… » reste rendue.
    expect(html).toContain("Envoi…");
    // Régions live et aria-busy inchangées.
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-busy="true"');
    // Aucune alerte d'erreur fantôme.
    expect(html.match(/role="alert"/g) ?? []).toHaveLength(0);
  });
});
