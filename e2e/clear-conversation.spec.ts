import { expect, test, type Page } from "@playwright/test";
import { openChat } from "./helpers";

/**
 * LOT 36 — Effacer la conversation (mono-conversation).
 * `/api/chat` n'est jamais appelé réellement : le flux SSE est mocké côté
 * navigateur (aucun appel LLM — règle AGENTS.md / LOT 26).
 */
const CONVERSATION_ID = "11111111-2222-4333-8444-555555555555";
const REPLY = "Réponse simulée de Webi.";
/** Le placeholder réel se termine par "…" (U+2026) : on cible la racine. */
const INPUT_PLACEHOLDER = "Posez votre question";
const EMPTY_STATE = "Commencez une conversation avec Webi";

function sseFrame(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function mockChatStream(page: Page): Promise<void> {
  const body = [
    sseFrame({
      type: "message_start",
      data: { messageId: "msg-e2e-clear" },
      conversationId: CONVERSATION_ID,
    }),
    sseFrame({
      type: "text_delta",
      data: { content: REPLY, index: 0 },
      conversationId: CONVERSATION_ID,
    }),
    sseFrame({
      type: "message_complete",
      data: {
        fullContent: REPLY,
        usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
        conversationId: CONVERSATION_ID,
      },
      conversationId: CONVERSATION_ID,
    }),
  ].join("");

  return page
    .route("**/api/chat", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body,
      }),
    )
    .then(() => undefined);
}

async function sendFirstMessage(page: Page): Promise<void> {
  await page.getByPlaceholder(INPUT_PLACEHOLDER).fill("Bonjour Webi");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const log = page.getByRole("log");
  await expect(log).toContainText("Bonjour Webi");
  await expect(log).toContainText(REPLY);
}

async function readPersistedId(page: Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem("webxia-conversation-id"));
}

test.describe("Effacer la conversation", () => {
  test("Trash2 + confirmation inline : transcript vidé, id perdu, persistant au reload", async ({
    page,
  }) => {
    await mockChatStream(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);
    await sendFirstMessage(page);
    expect(await readPersistedId(page)).toBe(CONVERSATION_ID);

    // Trash2 -> confirmation inline (« Effacer » / « Annuler »), 5 s max.
    const clearButton = page.getByRole("button", {
      name: "Effacer la conversation",
      exact: true,
    });
    await clearButton.click();

    const confirmButton = page.getByRole("button", { name: "Effacer", exact: true });
    const cancelButton = page.getByRole("button", { name: "Annuler", exact: true });
    await expect(confirmButton).toBeVisible();
    await expect(cancelButton).toBeVisible();
    // Le Trash2 a été remplacé : un seul « Effacer » au moment de la confirmer.
    await expect(clearButton).toHaveCount(0);

    // « Annuler » revient à l'état initial sans rien effacer.
    await cancelButton.click();
    await expect(clearButton).toBeVisible();
    await expect(page.getByRole("log")).toContainText(REPLY);

    // Re-confirmation : la valeur est bien effacée.
    await clearButton.click();
    await confirmButton.click();

    const log = page.getByRole("log");
    await expect(log).toContainText(EMPTY_STATE);
    await expect(log).not.toContainText(REPLY);
    expect(await readPersistedId(page)).toBeNull();

    // Rechargement : la conversation effacée ne réapparaît pas.
    await page.reload({ waitUntil: "domcontentloaded" });
    await openChat(page);
    await expect(page.getByRole("log")).toContainText(EMPTY_STATE);
    await expect(page.getByRole("log")).not.toContainText(REPLY);
    expect(await readPersistedId(page)).toBeNull();
  });
});
