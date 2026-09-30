import { expect, test, type Locator, type Page, type Request } from "@playwright/test";
import { fromJSON } from "seroval";
import { openChat } from "./helpers";

/**
 * LOT 35 — sidebar d'historique multi-conversations.
 *
 * Aucun appel réseau réel : les Server Functions (`/_serverFn/*`) sont mockées
 * côté navigateur avec un état en mémoire qui survit au `page.reload`, et le
 * flux `/api/chat` reste un SSE mocké (règle AGENTS.md : pas d'appel LLM).
 */
const REPLY = "Réponse simulée de Webi.";
const INPUT_PLACEHOLDER = "Posez votre question";
const HISTORY_TOGGLE = /Afficher ou masquer/;

interface StoreConversation {
  id: string;
  session_id: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface StoreMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Store {
  conversations: StoreConversation[];
  messages: StoreMessage[];
  clock: number;
}

function createStore(): Store {
  return { conversations: [], messages: [], clock: 0 };
}

/** Monotonic timestamps: list ordering and message ordering stay deterministic. */
function tick(store: Store): string {
  store.clock += 60_000;
  return new Date(Date.UTC(2026, 0, 1) + store.clock).toISOString();
}

/** Server-side rule: only the first user message becomes the display title. */
function titleFor(store: Store, conversationId: string): string | null {
  const first = store.messages.find(
    (message) => message.conversation_id === conversationId && message.role === "user",
  );
  const content = first?.content.trim();
  return content ? content : null;
}

/** Mirrors `handleCreateConversation`: archive every active row of the session. */
function archiveActive(store: Store, sessionId: string): void {
  for (const conversation of store.conversations) {
    if (conversation.session_id === sessionId && conversation.status === "active") {
      conversation.status = "archived";
    }
  }
}

function createConversation(store: Store, sessionId: string): StoreConversation {
  archiveActive(store, sessionId);
  const conversation: StoreConversation = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    status: "active",
    metadata: {},
    created_at: tick(store),
    updated_at: tick(store),
  };
  store.conversations.push(conversation);
  return conversation;
}

function handleList(store: Store, data: Record<string, unknown>) {
  const rows = store.conversations
    .filter((conversation) => conversation.session_id === data.session_id)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  const items = rows.map((conversation) => ({
    ...conversation,
    title: titleFor(store, conversation.id),
  }));
  const limit = typeof data.limit === "number" ? data.limit : 50;
  return {
    data: items,
    total: items.length,
    page: typeof data.page === "number" ? data.page : 1,
    limit,
    totalPages: Math.ceil(items.length / limit),
  };
}

function handleChatHistory(store: Store, data: Record<string, unknown>) {
  const owned = store.conversations.some(
    (conversation) =>
      conversation.id === data.conversationId && conversation.session_id === data.sessionId,
  );
  if (!owned) return [];
  return store.messages
    .filter((message) => message.conversation_id === data.conversationId)
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: Date.parse(message.created_at),
    }));
}

function handleDelete(store: Store, data: Record<string, unknown>): { success: true } {
  const index = store.conversations.findIndex(
    (conversation) => conversation.id === data.id && conversation.session_id === data.session_id,
  );
  if (index >= 0) {
    const [removed] = store.conversations.splice(index, 1);
    store.messages = store.messages.filter((message) => message.conversation_id !== removed.id);
  }
  return { success: true };
}

/** Decodes the seroval envelope (`{data}`) the client sends to `/_serverFn/*`. */
function decodePayload(request: Request): { method: string; data: Record<string, unknown> } | null {
  const method = request.method();
  const serialized =
    method === "GET" ? new URL(request.url()).searchParams.get("payload") : request.postData();
  if (!serialized) return null;
  try {
    const value = fromJSON(JSON.parse(serialized), { plugins: [] }) as {
      data?: Record<string, unknown>;
    };
    if (!value || typeof value !== "object" || !value.data) return null;
    return { method, data: value.data };
  } catch {
    return null;
  }
}

async function mockServerFns(page: Page, store: Store): Promise<void> {
  // `**` obligatoire après `_serverFn/` : un simple `*` ne traverse pas `/`.
  await page.route("**/_serverFn/**", async (route) => {
    const decoded = decodePayload(route.request());
    if (!decoded) {
      // Un payload non reconnu (autres Server Functions de la page) part au
      // serveur réel : la spec ne décide jamais à la place du backend.
      await route.fallback();
      return;
    }

    const { method, data } = decoded;
    let body: unknown;
    if (method === "GET" && "session_id" in data) {
      body = handleList(store, data);
    } else if (method === "POST" && "conversationId" in data) {
      body = handleChatHistory(store, data);
    } else if (method === "POST" && "id" in data && "session_id" in data) {
      body = handleDelete(store, data);
    } else if (method === "POST" && "session_id" in data) {
      body = createConversation(store, String(data.session_id));
    } else {
      await route.fallback();
      return;
    }

    // Le serveur réel renvoie la réponse sérialisée DANS une enveloppe
    // `{result, error, context}` ; sans `x-tss-serialized` le fetcher renvoie
    // le JSON brut, donc le mock doit fournir cette enveloppe (sinon
    // `handler()` lit `result.result` → `undefined` → React Query erreur).
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: body, error: null, context: {} }),
    });
  });
}

function sseFrame(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function mockChatStream(page: Page, store: Store): Promise<void> {
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON() as {
      message?: string;
      conversationId?: string;
      sessionId?: string;
      isRetry?: boolean;
    };

    let conversation = body.conversationId
      ? store.conversations.find((candidate) => candidate.id === body.conversationId)
      : undefined;
    if (!conversation) {
      conversation = createConversation(store, body.sessionId ?? "unknown-session");
    } else {
      conversation.updated_at = tick(store);
    }

    if (!body.isRetry) {
      store.messages.push({
        id: crypto.randomUUID(),
        conversation_id: conversation.id,
        role: "user",
        content: body.message ?? "",
        created_at: tick(store),
      });
    }
    store.messages.push({
      id: crypto.randomUUID(),
      conversation_id: conversation.id,
      role: "assistant",
      content: REPLY,
      created_at: tick(store),
    });

    const conversationId = conversation.id;
    const frames = [
      sseFrame({
        type: "message_start",
        data: { messageId: "msg-e2e" },
        conversationId,
      }),
      sseFrame({
        type: "text_delta",
        data: { content: REPLY, index: 0 },
        conversationId,
      }),
      sseFrame({
        type: "message_complete",
        data: {
          fullContent: REPLY,
          usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
          conversationId,
        },
        conversationId,
      }),
    ].join("");

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body: frames,
    });
  });
}

async function toggleHistory(page: Page): Promise<void> {
  await page.getByRole("button", { name: HISTORY_TOGGLE }).click();
}

function historyNav(page: Page): Locator {
  return page.getByRole("navigation", { name: /Historique des conversations/ });
}

/** Each `<li>` holds [select button, delete button] — index i → 2i / 2i+1. */
function selectButton(nav: Locator, index: number): Locator {
  return nav.locator("ul li > div > button").nth(index * 2);
}

function deleteButton(nav: Locator, index: number): Locator {
  return nav.locator("ul li > div > button").nth(index * 2 + 1);
}

function createFromSidebar(nav: Locator): Promise<void> {
  return nav.getByRole("button", { name: "Nouvelle conversation" }).first().click();
}

async function sendMessage(page: Page, message: string): Promise<void> {
  await page.getByPlaceholder(INPUT_PLACEHOLDER).fill(message);
  await page.getByRole("button", { name: "Envoyer" }).click();
}

test.describe("Historique des conversations (sidebar)", () => {
  test("création, titre dérivé et persistance après rechargement", async ({ page }) => {
    const store = createStore();
    await mockServerFns(page, store);
    await mockChatStream(page, store);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);

    // Panneau fermé par défaut : aucun `_serverFn` appelé avant l'ouverture.
    const toggle = page.getByRole("button", { name: HISTORY_TOGGLE });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(historyNav(page)).toHaveCount(0);

    await toggleHistory(page);
    const nav = historyNav(page);
    await expect(nav).toBeVisible();
    await expect(nav).toContainText("Aucune conversation");

    await createFromSidebar(nav);
    await expect(nav.locator("ul li")).toHaveCount(1);
    await expect(nav.locator("ul li > div > button").first()).toHaveAttribute(
      "aria-current",
      "true",
    );

    await sendMessage(page, "Bonjour Webi");
    const log = page.getByRole("log");
    await expect(log).toContainText("Bonjour Webi");
    await expect(log).toContainText(REPLY);

    // Refermer/rouvrir re-fetch (staleTime 0) → titre dérivé du 1er message.
    await toggleHistory(page);
    await expect(nav).toHaveCount(0);
    await toggleHistory(page);
    await expect(nav).toContainText("Bonjour Webi");

    // Rechargement : la conversation survit, le transcript est restauré.
    await page.reload({ waitUntil: "domcontentloaded" });
    await openChat(page);
    await toggleHistory(page);
    await expect(historyNav(page)).toContainText("Bonjour Webi");
    await expect(historyNav(page).locator("ul li")).toHaveCount(1);

    const logAfterReload = page.getByRole("log");
    await expect(logAfterReload).toContainText("Bonjour Webi");
    await expect(logAfterReload).toContainText(REPLY);
  });

  test("deux conversations sont isolées l'une de l'autre", async ({ page }) => {
    const store = createStore();
    await mockServerFns(page, store);
    await mockChatStream(page, store);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);
    await toggleHistory(page);
    const nav = historyNav(page);
    await expect(nav).toBeVisible();
    const log = page.getByRole("log");

    // Conversation A
    await createFromSidebar(nav);
    await expect(nav.locator("ul li")).toHaveCount(1);
    await sendMessage(page, "Premier message");
    await expect(log).toContainText(REPLY);

    // Conversation B : la sélection vide le transcript de A.
    await createFromSidebar(nav);
    await expect(nav.locator("ul li")).toHaveCount(2);
    await expect(log).toContainText("Commencez une conversation avec Webi");
    await sendMessage(page, "Second message");
    await expect(log).toContainText(REPLY);

    // Rafraîchit la liste pour afficher les deux titres dérivés.
    await toggleHistory(page);
    await expect(nav).toHaveCount(0);
    await toggleHistory(page);
    await expect(nav).toContainText("Premier message");
    await expect(nav).toContainText("Second message");
    // La plus récente est en tête (tri updated_at DESC).
    await expect(selectButton(nav, 0)).toContainText("Second message");

    // Retour sur A : seul le transcript de A est restauré.
    await selectButton(nav, 1).click();
    await expect(log).toContainText("Premier message");
    await expect(log).toContainText(REPLY);
    await expect(log).not.toContainText("Second message");
    await expect(selectButton(nav, 1)).toHaveAttribute("aria-current", "true");
    await expect(selectButton(nav, 0)).not.toHaveAttribute("aria-current", "true");
  });

  test("suppression : liste vidée, sélection et transcript nettoyés", async ({ page }) => {
    const store = createStore();
    await mockServerFns(page, store);
    await mockChatStream(page, store);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);
    await toggleHistory(page);
    const nav = historyNav(page);
    await expect(nav).toBeVisible();

    await createFromSidebar(nav);
    await sendMessage(page, "A supprimer");
    const log = page.getByRole("log");
    await expect(log).toContainText(REPLY);

    await deleteButton(nav, 0).click();

    await expect(nav.locator("ul li")).toHaveCount(0);
    await expect(nav).toContainText("Aucune conversation");
    await expect(log).toContainText("Commencez une conversation avec Webi");

    const persisted = await page.evaluate(() => ({
      conversationKey: window.localStorage.getItem("webxia-conversation-id"),
      conversationId: JSON.parse(window.localStorage.getItem("webxia-chat") ?? '{"state":{}}').state
        .conversationId as string | null,
    }));
    expect(persisted.conversationKey).toBeNull();
    expect(persisted.conversationId).toBeNull();
  });
});
