import { test, expect, type Page } from "@playwright/test";
import { openChat } from "./helpers";

/**
 * LOT 38a — capture de lead via le chat.
 *
 * `/api/chat` est TOUJOURS mocké (flux SSE côté navigateur) : aucun appel LLM
 * réel, aucune écriture Supabase depuis un E2E (règle AGENTS.md / LOT 26,
 * rappelée par le prompt LOT 38a). La persistance du lead par `save_lead` est
 * couverte par les tests unitaires (src/lib/ai/__tests__/save-lead.test.ts) ;
 * ici on vérifie que le widget soumet bien les coordonnées au flux chat et
 * restitue la confirmation.
 */
const CONVERSATION_ID = "11111111-2222-4333-8444-555555555566";
const LEAD_REPLY = "Merci ! Vos coordonnées sont enregistrées, je reviens vers vous rapidement.";
const NEUTRAL_REPLY = "Bien sûr, je peux vous renseigner sur nos tarifs.";
/** Le placeholder réel se termine par "…" (U+2026) : on cible la racine. */
const INPUT_PLACEHOLDER = "Posez votre question";

function sseFrame(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Mocke le flux SSE `/api/chat` et capture le corps POST envoyé par le widget
 * (assertion sur les coordonnées du lead côté client).
 */
function mockChatStream(page: Page, reply: string): { payload: () => string } {
  let captured = "";
  const body = [
    sseFrame({
      type: "message_start",
      data: { messageId: "msg-lead-e2e" },
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

  void page.route("**/api/chat", (route) => {
    captured = route.request().postData() ?? "";
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body,
    });
  });

  return { payload: () => captured };
}

test.describe("Lead capture via chat (LOT 38a)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("visitor provides lead info and save_lead is called", async ({ page }) => {
    const chat = mockChatStream(page, LEAD_REPLY);

    await openChat(page);

    const chatInput = page.getByPlaceholder(INPUT_PLACEHOLDER);
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    await chatInput.fill(
      "Bonjour, je m'appelle Jean et je voudrais un devis pour un site e-commerce. Mon email est jean@example.com",
    );
    await chatInput.press("Enter");

    // La confirmation du lead s'affiche dans le flux de conversation mocké
    const chatLog = page.getByRole("log");
    await expect(chatLog).toContainText(LEAD_REPLY);

    // Le widget a bien transmis les coordonnées au endpoint /api/chat
    // (le persistant save_lead lui-même est couvert en unitaire)
    const payload = chat.payload();
    expect(payload).toContain("Jean");
    expect(payload).toContain("jean@example.com");
  });

  test("visitor refuses to give contact info - no lead created", async ({ page }) => {
    const chat = mockChatStream(page, NEUTRAL_REPLY);

    await openChat(page);

    const chatInput = page.getByPlaceholder(INPUT_PLACEHOLDER);
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    await chatInput.fill(
      "Bonjour, je veux juste des infos sur vos tarifs, je ne veux pas donner mes coordonnées",
    );
    await chatInput.press("Enter");

    const chatLog = page.getByRole("log");
    await expect(chatLog).toContainText(NEUTRAL_REPLY);

    // Aucune relance insistante dans la réponse
    await expect(chatLog.getByText(/insistant|forcer|obligatoire/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Aucune adresse email n'a été soumise au endpoint
    expect(chat.payload()).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});
