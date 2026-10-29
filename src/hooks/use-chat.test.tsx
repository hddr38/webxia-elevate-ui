import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * LOT 36 — « Effacer la conversation ». La sidebar multi-conversations a été
 * retirée : `resetConversation()` (état pré-LOT 35) est le seul chemin de
 * remise à zéro. Test d'unitaire du callback lui-même (le rendu inline de la
 * confirmation est couvert par e2e/clear-conversation.spec.ts).
 *
 * CHAT-CLEAR-FIX (Politique A) : le clear régénère désormais le `sessionId`
 * (store `resetSessionId`, générateur existant `createWebiSessionId`) pour que
 * le serveur ouvre une NOUVELLE conversation (aucun historique réinjecté) et ne
 * recherche que les mémoires de la nouvelle session — aucune suppression
 * serveur. Tests obligatoires 1 à 7 et 10 ci-dessous ; 8 et 9 sont côté
 * serveur dans src/lib/ai/memory/memory-service.test.ts.
 *
 * Environnement node : aucun RTL (conventions AGENTS.md) — le callback est
 * capturé via `renderToStaticMarkup` sur un probe, puis invoqué.
 * `localStorage` n'existe pas en node : stub avant les imports dynamiques
 * (même schéma que src/stores/chat-store.test.ts).
 */
function createLocalStorageStub() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}

const localStorageStub = createLocalStorageStub();
vi.stubGlobal("localStorage", localStorageStub);

// Scénarios d'envoi heureux ici : jamais de toast, mais le mock évite
// d'importer le vrai sonner côté node (même schéma que use-chat-status.test.tsx).
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const CONVERSATION_ID = "11111111-2222-4333-8444-555555555555";
/** Session d'avant Effacer — UUID valide pour que ensureSessionId le réutilise. */
const OLD_SESSION_ID = "aaaaaaaa-1111-4222-8333-444444444444";
/** Conversation attribuée par le serveur au tour d'après Effacer. */
const SERVER_CONVERSATION_ID = "99999999-8888-4777-8666-555555555555";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Chat = typeof import("./use-chat").useChat extends (...args: never[]) => infer R ? R : never;

function sseFrame(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Response-like ok avec body SSE contrôlé (le hook lit reader.read()). */
function streamResponse(frames: string[]) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async (): Promise<{ done: boolean; value?: Uint8Array }> =>
          i < frames.length
            ? { done: false, value: encoder.encode(frames[i++]) }
            : { done: true, value: undefined },
      }),
    },
  };
}

function messageStartFrame(conversationId: string): string {
  return sseFrame({
    type: "message_start",
    data: { messageId: "msg-1" },
    conversationId,
    timestamp: 1,
    requestId: "req-1",
  });
}

function messageCompleteFrame(conversationId: string): string {
  return sseFrame({
    type: "message_complete",
    data: {
      fullContent: "Réponse de Webi",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      conversationId,
    },
    conversationId,
    timestamp: 2,
    requestId: "req-1",
  });
}

describe("useChat.resetConversation", () => {
  it("clears the transcript, the conversation id and the persisted id", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { LocaleProvider } = await import("@/lib/locale-context");
    const { useChat } = await import("./use-chat");
    const { useChatStore } = await import("@/stores/chat-store");

    useChatStore.setState({
      messages: [
        { id: "m1", role: "user", content: "Bonjour Webi", timestamp: 1 },
        { id: "m2", role: "assistant", content: "Bonjour !", timestamp: 2 },
      ],
      conversationId: CONVERSATION_ID,
    });
    localStorageStub.setItem("webxia-conversation-id", CONVERSATION_ID);

    const captured: { reset: (() => void) | null } = { reset: null };
    function Probe() {
      captured.reset = useChat().resetConversation;
      return null;
    }
    renderToStaticMarkup(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(captured.reset).toBeTypeOf("function");

    captured.reset?.();

    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().conversationId).toBeNull();
    expect(localStorageStub.removeItem).toHaveBeenCalledWith("webxia-conversation-id");
    expect(localStorageStub.getItem("webxia-conversation-id")).toBeNull();
  });
});

/**
 * CHAT-CLEAR-FIX — Politique A : « Effacer la conversation » régénère le
 * sessionId (1-5), le prochain tour part donc sans ancien conversationId (6)
 * et avec le nouveau sessionId — exactement la valeur que le serveur passe à
 * `searchMemory({ filters: { sessionId } })` (7) — tout en restant un envoi
 * normal (10). Les mémoires globales/session sont couvertes côté serveur dans
 * memory-service.test.ts (8-9).
 */
describe("CHAT-CLEAR-FIX — Politique A : nouvelle session après Effacer", () => {
  beforeEach(() => {
    localStorageStub.clear();
    localStorageStub.getItem.mockClear();
    localStorageStub.setItem.mockClear();
    localStorageStub.removeItem.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  /**
   * Prépare un probe SSR ré-affichable : le hook est capturé à chaque rendu,
   * donc un second rendu après `resetConversation()` referme `sendMessage`
   * sur l'état post-clear (conversationId null), comme un vrai React commit.
   */
  async function seedConversation() {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { LocaleProvider } = await import("@/lib/locale-context");
    const { useChat } = await import("./use-chat");
    const { useChatStore } = await import("@/stores/chat-store");

    useChatStore.setState({
      sessionId: OLD_SESSION_ID,
      conversationId: CONVERSATION_ID,
      isStreaming: false,
      temporaryError: null,
      messages: [
        { id: "m1", role: "user", content: "Bonjour Webi", timestamp: 1 },
        { id: "m2", role: "assistant", content: "Bororo est un village.", timestamp: 2 },
      ],
    });
    localStorageStub.setItem("webxia-conversation-id", CONVERSATION_ID);

    const captured: { chat: Chat | null } = { chat: null };
    function Probe() {
      captured.chat = useChat();
      return null;
    }
    const render = (): Chat => {
      renderToStaticMarkup(
        <LocaleProvider>
          <Probe />
        </LocaleProvider>,
      );
      if (!captured.chat) throw new Error("probe failed");
      return captured.chat;
    };
    render();

    return { render, useChatStore };
  }

  it("1. régénère un sessionId différent (UUID valide) après Effacer", async () => {
    const { render, useChatStore } = await seedConversation();
    expect(useChatStore.getState().sessionId).toBe(OLD_SESSION_ID);

    render().resetConversation();

    const after = useChatStore.getState().sessionId;
    expect(after).not.toBe(OLD_SESSION_ID);
    expect(after).toMatch(UUID_RE);
  });

  it("2. remet le conversationId client à null", async () => {
    const { render, useChatStore } = await seedConversation();

    render().resetConversation();

    expect(useChatStore.getState().conversationId).toBeNull();
  });

  it("3. supprime la clé localStorage webxia-conversation-id", async () => {
    const { render } = await seedConversation();
    expect(localStorageStub.getItem("webxia-conversation-id")).toBe(CONVERSATION_ID);

    render().resetConversation();

    expect(localStorageStub.removeItem).toHaveBeenCalledWith("webxia-conversation-id");
    expect(localStorageStub.getItem("webxia-conversation-id")).toBeNull();
  });

  it("4. persiste le nouveau sessionId (et conversationId null) dans le blob webxia-chat", async () => {
    const { render, useChatStore } = await seedConversation();

    render().resetConversation();

    const blob = JSON.parse(localStorageStub.getItem("webxia-chat") ?? "null") as {
      state?: { sessionId?: string | null; conversationId?: string | null };
    } | null;
    const newSessionId = useChatStore.getState().sessionId;
    expect(blob?.state?.sessionId).toBe(newSessionId);
    expect(blob?.state?.sessionId).not.toBe(OLD_SESSION_ID);
    expect(blob?.state?.conversationId).toBeNull();
  });

  it("5. ensureSessionId réutilise le nouveau sessionId (aucune troisième régénération)", async () => {
    const { render, useChatStore } = await seedConversation();

    render().resetConversation();

    const newSessionId = useChatStore.getState().sessionId;
    const next = useChatStore.getState().ensureSessionId();
    expect(next).toBe(newSessionId);
    expect(useChatStore.getState().ensureSessionId()).toBe(next);
  });

  it("6+7. prochain envoi : sans l'ancien conversationId, avec le nouveau sessionId", async () => {
    const { render, useChatStore } = await seedConversation();

    render().resetConversation();
    const newSessionId = useChatStore.getState().sessionId;
    if (!newSessionId) throw new Error("sessionId non régénéré par le clear");

    // Second rendu : le closure sendMessage voit conversationId = null.
    const chat = render();
    const sent: Array<{ conversationId?: string; sessionId?: string }> = [];
    const fetchMock = vi.fn(async (url: unknown, init?: { body?: unknown }) => {
      expect(url).toBe("/api/chat");
      sent.push(JSON.parse(String(init?.body ?? "{}")) as (typeof sent)[number]);
      return streamResponse([
        messageStartFrame(SERVER_CONVERSATION_ID),
        messageCompleteFrame(SERVER_CONVERSATION_ID),
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await chat.sendMessage("Bororo ?");

    expect(sent).toHaveLength(1);
    const payload = sent[0];
    // 6. l'ancien conversationId n'est jamais renvoyé → le serveur créera une
    // conversation (getOrCreateConversation sur la NOUVELLE session).
    expect(payload.conversationId).toBeUndefined();
    // 7. nouveau sessionId = filtre transmis à searchMemory côté serveur.
    expect(payload.sessionId).toBe(newSessionId);
    expect(payload.sessionId).not.toBe(OLD_SESSION_ID);
  });

  it("10. non-régression : envoi normal après Effacer adopte la nouvelle conversation serveur", async () => {
    const { render, useChatStore } = await seedConversation();

    render().resetConversation();
    const chat = render();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamResponse([
          messageStartFrame(SERVER_CONVERSATION_ID),
          messageCompleteFrame(SERVER_CONVERSATION_ID),
        ]),
      ),
    );

    await chat.sendMessage("Bonjour Webi");

    expect(useChatStore.getState().conversationId).toBe(SERVER_CONVERSATION_ID);
    expect(localStorageStub.getItem("webxia-conversation-id")).toBe(SERVER_CONVERSATION_ID);
    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages.at(-1)).toMatchObject({ role: "assistant", content: "Réponse de Webi" });
    expect(useChatStore.getState().isStreaming).toBe(false);
  });
});
