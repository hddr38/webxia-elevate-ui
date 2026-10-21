import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CHAT-2 — statut optimiste du message utilisateur.
 *
 * Cycle de vie verrouillé ici :
 * - envoi  → user `status:"pending"` + bulle assistant vide (synchrone, avant fetch) ;
 * - `message_start` (émis serveur APRÈS addMessage) → plus aucun pending (confirmé) ;
 * - échec HTTP/réseau AVANT message_start → `status:"failed"` + temporaryError ;
 * - AbortError (abort volontaire) → ni pending ni failed (statut effacé) ;
 * - retry depuis une échouée → repasse en pending, purge l'assistant échoué,
 *   ne duplique jamais le message user ;
 * - invariants : partialize = {conversationId, sessionId} uniquement (jamais de
 *   statut persisté), compteur de limite = nombre de user messages quel que
 *   soit le statut.
 *
 * Environnement node (conventions AGENTS.md, aucun RTL) : le hook est capturé
 * via renderToStaticMarkup sur un probe ; localStorage stubbé avant imports
 * dynamiques (même schéma que use-chat.test.tsx) ; fetch mocké par test.
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

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const CONVERSATION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

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

function httpErrorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    json: async () => ({ message }),
  };
}

function messageStartFrame(): string {
  return sseFrame({
    type: "message_start",
    data: { messageId: "msg_1" },
    timestamp: 1,
    conversationId: CONVERSATION_ID,
    requestId: "req-1",
  });
}

function messageCompleteFrame(): string {
  return sseFrame({
    type: "message_complete",
    data: {
      fullContent: "Réponse de Webi",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      conversationId: CONVERSATION_ID,
    },
    timestamp: 2,
    conversationId: CONVERSATION_ID,
    requestId: "req-1",
  });
}

function abortError(): Error {
  return Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
}

describe("useChat — statut optimiste (CHAT-2)", () => {
  beforeEach(() => {
    localStorageStub.clear();
    localStorageStub.setItem.mockClear();
    localStorageStub.removeItem.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  async function setup() {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { LocaleProvider } = await import("@/lib/locale-context");
    const { useChat } = await import("./use-chat");
    const { useChatStore } = await import("@/stores/chat-store");

    useChatStore.getState().reset();

    const captured: { chat: Chat | null } = { chat: null };
    function Probe() {
      captured.chat = useChat();
      return null;
    }
    renderToStaticMarkup(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    if (!captured.chat) throw new Error("probe failed");
    return { chat: captured.chat, useChatStore };
  }

  it("1+2. envoi : user pending + assistant vide ; message_start confirme (plus aucun pending)", async () => {
    const { chat, useChatStore } = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamResponse([messageStartFrame(), messageCompleteFrame()])),
    );

    const done = chat.sendMessage("Bonjour Webi");

    // Synchrone, avant résolution du fetch : bulle user pending + assistant vide.
    const during = useChatStore.getState().messages;
    expect(during).toHaveLength(2);
    expect(during[0]).toMatchObject({ role: "user", content: "Bonjour Webi", status: "pending" });
    expect(during[1]).toMatchObject({ role: "assistant", content: "" });
    // Le retour du hook capturé est un instantané de rendu statique : lire
    // l'état live via getState() (isStreaming est un booléen dérivé du store).
    expect(useChatStore.getState().isStreaming).toBe(true);

    await done;

    // message_start (après addMessage serveur) a effacé le statut → confirmé.
    const after = useChatStore.getState().messages;
    expect(after[0].role).toBe("user");
    expect(after[0].status).toBeUndefined();
    // message_complete hydrate la réponse.
    expect(after[1]).toMatchObject({ role: "assistant", content: "Réponse de Webi" });
    expect(useChatStore.getState().conversationId).toBe(CONVERSATION_ID);
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("3. échec HTTP avant message_start : status failed + temporaryError défini", async () => {
    const { chat, useChatStore } = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => httpErrorResponse(429, "Rate limit exceeded")),
    );

    await chat.sendMessage("Bonjour");

    const messages = useChatStore.getState().messages;
    expect(messages[0]).toMatchObject({ role: "user", status: "failed" });
    expect(messages[1].role).toBe("assistant"); // placeholder conservé, rempli d'erreur
    expect(useChatStore.getState().temporaryError).toBe("Rate limit exceeded");
  });

  it("4. erreur réseau avant message_start : status failed", async () => {
    const { chat, useChatStore } = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );

    await chat.sendMessage("Bonjour");

    const messages = useChatStore.getState().messages;
    expect(messages[0]).toMatchObject({ role: "user", status: "failed" });
    expect(useChatStore.getState().temporaryError).toBe("Failed to fetch");
  });

  it("5. AbortError : ni pending ni failed (statut effacé, pas de bannière)", async () => {
    const { chat, useChatStore } = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(abortError())),
    );

    await chat.sendMessage("Bonjour");

    const messages = useChatStore.getState().messages;
    expect(messages[0].role).toBe("user");
    expect(messages[0].status).toBeUndefined();
    expect(useChatStore.getState().temporaryError).toBeNull();
    // L'assistant vide reçoit le libellé « stopped » (comportement existant).
    expect(messages[1]).toMatchObject({ role: "assistant" });
    expect(messages[1].content).toBe("Réponse interrompue.");
  });

  it("5b. abort APRÈS message_start : aucune régression (user déjà confirmé, pas de failed)", async () => {
    const { chat, useChatStore } = await setup();
    // Stream qui livre message_start puis meurt en AbortError (abort utilisateur
    // pendant le streaming).
    let reads = 0;
    const encoder = new TextEncoder();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: async () => {
              reads += 1;
              if (reads === 1) return { done: false, value: encoder.encode(messageStartFrame()) };
              throw abortError();
            },
          }),
        },
      })),
    );

    await chat.sendMessage("Bonjour");

    const messages = useChatStore.getState().messages;
    expect(messages[0].role).toBe("user");
    expect(messages[0].status).toBeUndefined();
    expect(useChatStore.getState().temporaryError).toBeNull();
  });

  it("6. retry depuis une bulle failed : pending rengagé, assistant purgé, aucune duplication", async () => {
    const { chat, useChatStore } = await setup();

    // a) premier essai : échec réseau → failed.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    await chat.sendMessage("Bonjour");

    const failedState = useChatStore.getState().messages;
    expect(failedState[0]).toMatchObject({ role: "user", content: "Bonjour", status: "failed" });
    expect(failedState[1].role).toBe("assistant"); // placeholder d'erreur

    // b) retry : nouveau flux qui réussit.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamResponse([messageStartFrame(), messageCompleteFrame()])),
    );
    const done = chat.retryLastMessage();

    // Synchrone, avant fetch : l'assistant échoué est purgé puis remplacé par
    // un placeholder neuf (content "") ; user repasse en pending.
    const mid = useChatStore.getState().messages;
    expect(mid).toHaveLength(2);
    expect(mid[0]).toMatchObject({ role: "user", content: "Bonjour", status: "pending" });
    expect(mid[1]).toMatchObject({ role: "assistant", content: "" });

    await done;

    const after = useChatStore.getState().messages;
    const userMessages = after.filter((m) => m.role === "user");
    expect(userMessages).toHaveLength(1); // jamais de duplication
    expect(userMessages[0].status).toBeUndefined(); // confirmé via message_start
    expect(after[after.length - 1]).toMatchObject({
      role: "assistant",
      content: "Réponse de Webi",
    });
  });

  it("invariant. partialize ne capture jamais messages ni statut", async () => {
    const { useChatStore } = await setup();
    useChatStore.setState({
      sessionId: CONVERSATION_ID,
      conversationId: CONVERSATION_ID,
      messages: [
        {
          id: "u1",
          role: "user",
          content: "test",
          timestamp: 1,
          status: "pending",
        },
      ],
    });

    const options = useChatStore.persist.getOptions();
    const partial = options.partialize?.(useChatStore.getState());
    expect(partial).toBeDefined();
    expect(Object.keys(partial as object).sort()).toEqual(["conversationId", "sessionId"]);
    expect("messages" in (partial as object)).toBe(false);
  });
});
