// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { LocaleProvider } from "@/lib/locale-context";
import { useChat } from "./use-chat";
import { useChatStore } from "@/stores/chat-store";

/**
 * CHAT-2 — invariant du compteur de limite.
 *
 * Verrouille que `messageCount` compte TOUS les user messages quel que soit
 * leur statut (pending / failed / confirmé) : un filtre qui exclurait les
 * statuts non confirmés laisserait des utilisateurs dépasser la limite.
 *
 * Rendu CLIENT (happy-dom + createRoot + flushSync) et non renderToStaticMarkup :
 * zustand sert `getInitialState()` comme getServerSnapshot en SSR, donc un
 * probe statique ne verrait jamais l'état seedé (le hook passerait à 0).
 */

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

function renderChat(): ReturnType<typeof useChat> {
  const box: { current: ReturnType<typeof useChat> | null } = { current: null };
  function Probe() {
    box.current = useChat();
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
  });
  root.unmount();
  container.remove();
  if (!box.current) throw new Error("probe failed");
  return box.current;
}

describe("useChat — compteur de limite (CHAT-2)", () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it("compte tous les user messages, quel que soit le statut (pending/failed compris)", () => {
    useChatStore.setState({
      messages: [
        { id: "u1", role: "user", content: "a", timestamp: 1, status: "pending" },
        { id: "a1", role: "assistant", content: "r", timestamp: 2 },
        { id: "u2", role: "user", content: "b", timestamp: 3, status: "failed" },
        { id: "u3", role: "user", content: "c", timestamp: 4 },
      ],
    });
    expect(useChatStore.getState().messages).toHaveLength(4);

    const chat = renderChat();
    expect(chat.messageCount).toBe(3);
    expect(chat.maxMessages).toBe(10);
    expect(chat.isNearLimit).toBe(false);
    // Le rendu est lecture seule : l'état brut est inchangé.
    expect(useChatStore.getState().messages).toHaveLength(4);
  });
});
