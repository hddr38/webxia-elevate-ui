import { expect, test, type Page } from "@playwright/test";
import { openChat } from "./helpers";

/**
 * `/api/chat` n'est jamais appelé : la spec mocke le flux SSE côté
 * navigateur (aucun appel LLM réel — règle AGENTS.md / LOT 26).
 */
const CONVERSATION_ID = "11111111-2222-4333-8444-555555555555";
const REPLY = "Réponse simulée de Webi.";
/** Le placeholder réel se termine par "…" (U+2026) : on cible la racine. */
const INPUT_PLACEHOLDER = "Posez votre question";

function sseFrame(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function mockChatStream(page: Page, reply: string): Promise<void> {
  const body = [
    sseFrame({
      type: "message_start",
      data: { messageId: "msg-e2e" },
      conversationId: CONVERSATION_ID,
    }),
    sseFrame({
      type: "text_delta",
      data: { content: reply, index: 0 },
      conversationId: CONVERSATION_ID,
    }),
    sseFrame({
      type: "message_complete",
      data: {
        fullContent: reply,
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

test.describe("Chat Webi", () => {
  test("stream SSE mocké affiche la réponse et adopte la conversation", async ({ page }) => {
    await mockChatStream(page, REPLY);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);

    const log = page.getByRole("log");
    await expect(log).toContainText("Commencez une conversation avec Webi");

    await page.getByPlaceholder(INPUT_PLACEHOLDER).fill("Bonjour Webi");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(log).toContainText("Bonjour Webi");
    await expect(log).toContainText(REPLY);

    const conversationId = await page.evaluate(() =>
      window.localStorage.getItem("webxia-conversation-id"),
    );
    expect(conversationId).toBe(CONVERSATION_ID);
  });

  test("hydratation fullContent quand le stream se réduit au blanc (LOT 38a quinquies)", async ({
    page,
  }) => {
    // Un tool-call inline leaké streamé est strippé côté client en "\n\n" :
    // ce contenu blanc-only ne doit PAS bloquer l'hydratation de la
    // confirmation persistée (régression observée en e2e réel NIM run 2).
    const CONFIRMATION = "Vos coordonnées ont bien été enregistrées.";
    const body = [
      sseFrame({
        type: "message_start",
        data: { messageId: "msg-e2e-ws" },
        conversationId: CONVERSATION_ID,
      }),
      sseFrame({
        type: "text_delta",
        data: { content: "\n\n", index: 0 },
        conversationId: CONVERSATION_ID,
      }),
      sseFrame({
        type: "message_complete",
        data: {
          fullContent: CONFIRMATION,
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          conversationId: CONVERSATION_ID,
        },
        conversationId: CONVERSATION_ID,
      }),
    ].join("");

    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body,
      }),
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);

    await page.getByPlaceholder(INPUT_PLACEHOLDER).fill("Je veux un site vitrine");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.getByRole("log")).toContainText(CONFIRMATION);
  });

  test("erreur serveur affiche une alerte générique", async ({ page }) => {
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "boom-e2e" }),
      }),
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);

    await page.getByPlaceholder(INPUT_PLACEHOLDER).fill("déclenche une erreur");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.getByText("boom-e2e")).toBeVisible();
    await expect(page.getByRole("log")).toContainText("Une erreur est survenue.");
  });

  test("Échap ferme le widget", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);

    await page.keyboard.press("Escape");

    await expect(page.locator("[data-webi-launcher]")).toBeVisible();
    await expect(page.getByRole("log")).toBeHidden();
  });
});
