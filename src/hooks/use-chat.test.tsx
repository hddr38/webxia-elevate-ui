import { describe, it, expect, vi } from "vitest";

/**
 * LOT 36 — « Effacer la conversation ». La sidebar multi-conversations a été
 * retirée : `resetConversation()` (état pré-LOT 35) est le seul chemin de
 * remise à zéro. Test d'unitaire du callback lui-même (le rendu inline de la
 * confirmation est couvert par e2e/clear-conversation.spec.ts).
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

const CONVERSATION_ID = "11111111-2222-4333-8444-555555555555";

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
