import { test, expect, type Page } from "@playwright/test";
import { openChat } from "./helpers";

/**
 * LOT 38a – capture de lead via le chat.
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
 * Mocke le flux SSE `/api/chat` et capture le corps POST envoyé
 * par le widget (assertion sur les coordonnées du lead côté client).
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
  test("visitor provides lead info and save_lead is called", async ({ page }) => {
    const chat = mockChatStream(page, LEAD_REPLY);

    await page.goto("/");
    await openChat(page);
    const chatInput = page.getByPlaceholder(INPUT_PLACEHOLDER);
    await expect(chatInput).toBeVisible({ timeout: 5000 });
    await chatInput.fill("Je m'" + "appelle Jean, mon email est jean@example.com");
    await chatInput.press("Enter");

    // La confirmation assistant s'affiche quand même
    const chatLog = page.getByRole("log");
    await expect(chatLog).toContainText(LEAD_REPLY);

    // ... mais aucun jargon interne n'apparaît
    await expect(chatLog).not.toContainText(/save_lead/i);
    await expect(chatLog).not.toContainText("SAVE_LEAD");
    await expect(chatLog).not.toContainText("leadId");
    await expect(chatLog).not.toContainText("11111111-2222-3333-4444-555555555999");
    await expect(chatLog).not.toContainText("Webi exécute");
  });

  test("visitor refuses to give contact info - no lead created", async ({ page }) => {
    const chat = mockChatStream(page, NEUTRAL_REPLY);

    await page.goto("/");
    await openChat(page);
    const chatInput = page.getByPlaceholder(INPUT_PLACEHOLDER);
    await expect(chatInput).toBeVisible({ timeout: 5000 });
    await chatInput.fill("Non, je ne veux pas donner mes coordonnées.");
    await chatInput.press("Enter");

    const chatLog = page.getByRole("log");
    await expect(chatLog).toContainText(NEUTRAL_REPLY);
    expect(chat.payload()).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  test("internal tool frames (save_lead) stay invisible in the UI", async ({ page }) => {
    const toolReply = [
      sseFrame({
        type: "message_start",
        data: { messageId: "msg-tool-e2e" },
        conversationId: CONVERSATION_ID,
      }),
      sseFrame({
        type: "tool_start",
        data: {
          toolName: "save_lead",
          toolCallId: "call-1",
          conversationId: CONVERSATION_ID,
        },
      }),
      sseFrame({
        type: "text_delta",
        data: { content: LEAD_REPLY, index: 0 },
        conversationId: CONVERSATION_ID,
      }),
      sseFrame({
        type: "tool_result",
        data: {
          toolName: "save_lead",
          toolCallId: "call-1",
          content: { leadId: "lead-123", createdAt: "2026-10-01T00:00:00Z" },
          conversationId: CONVERSATION_ID,
        },
      }),
      sseFrame({
        type: "message_complete",
        data: {
          fullContent: LEAD_REPLY,
          usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
          conversationId: CONVERSATION_ID,
        },
        conversationId: CONVERSATION_ID,
      }),
    ].join("");

    void page.route("**/api/chat", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: toolReply,
      });
    });

    await page.goto("/");
    await openChat(page);
    const chatInput = page.getByPlaceholder(INPUT_PLACEHOLDER);
    await expect(chatInput).toBeVisible({ timeout: 5000 });
    await chatInput.fill("Je m'" + "appelle Jean, mon email est jean@example.com");
    await chatInput.press("Enter");

    const chatLog = page.getByRole("log");
    await expect(chatLog).toContainText(LEAD_REPLY);

    // Vérifier que le frame tool_start/tool_result n'a pas pollué l'affichage
    await expect(chatLog).not.toContainText(/save_lead/i);
    await expect(chatLog).not.toContainText("SAVE_LEAD");
    await expect(chatLog).not.toContainText("leadId");
    await expect(chatLog).not.toContainText("Webi exécute");
  });

  test("FIX A server break: tool frames then confirmation, no text_delta (Phase 2)", async ({
    page,
  }) => {
    // The FIX A path streams message_start + hidden tool frames and then a
    // message_complete carrying the standard confirmation — with zero
    // text_delta. The placeholder bubble must hydrate from fullContent.
    const CONFIRMATION =
      "Vos coordonnées ont bien été enregistrées. Nous vous recontacterons prochainement.";
    const body = [
      sseFrame({
        type: "message_start",
        data: { messageId: "msg-fixa-e2e" },
        conversationId: CONVERSATION_ID,
      }),
      sseFrame({
        type: "tool_start",
        data: {
          toolName: "save_lead",
          toolCallId: "call-1",
          conversationId: CONVERSATION_ID,
        },
      }),
      sseFrame({
        type: "tool_result",
        data: {
          toolName: "save_lead",
          toolCallId: "call-1",
          content: { leadId: "lead-fixa-1", createdAt: "2026-10-06T00:00:00Z" },
          conversationId: CONVERSATION_ID,
        },
      }),
      sseFrame({
        type: "message_complete",
        data: {
          fullContent: CONFIRMATION,
          usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
          conversationId: CONVERSATION_ID,
        },
        conversationId: CONVERSATION_ID,
      }),
    ].join("");

    void page.route("**/api/chat", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body,
      });
    });

    await page.goto("/");
    await openChat(page);
    const chatInput = page.getByPlaceholder(INPUT_PLACEHOLDER);
    await expect(chatInput).toBeVisible({ timeout: 5000 });
    await chatInput.fill("Je m'" + "appelle Jean, mon email est jean@example.com");
    await chatInput.press("Enter");

    // The empty placeholder hydrates from message_complete.fullContent.
    const chatLog = page.getByRole("log");
    await expect(chatLog).toContainText(CONFIRMATION);

    // Tool frames stay invisible.
    await expect(chatLog).not.toContainText(/save_lead/i);
    await expect(chatLog).not.toContainText("leadId");
    await expect(chatLog).not.toContainText("Webi exécute");
  });

  test("inline tool markup in text_delta is stripped from UI (LOT 38a quinquies)", async ({
    page,
  }) => {
    const markupReply = [
      sseFrame({
        type: "message_start",
        data: { messageId: "msg-markup-e2e" },
        conversationId: CONVERSATION_ID,
      }),
      sseFrame({
        type: "text_delta",
        data: {
          content:
            "Bonjour <func" + "tion=save_lead>x" + "</param" + "eter>" + "</func" + "tion> après",
          index: 0,
        },
        conversationId: CONVERSATION_ID,
      }),
      sseFrame({
        type: "message_complete",
        data: {
          fullContent: "Bonjour après",
          usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
          conversationId: CONVERSATION_ID,
        },
        conversationId: CONVERSATION_ID,
      }),
    ].join("");

    void page.route("**/api/chat", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: markupReply,
      });
    });

    await page.goto("/");
    await openChat(page);
    const chatInput = page.getByPlaceholder(INPUT_PLACEHOLDER);
    await expect(chatInput).toBeVisible({ timeout: 5000 });
    await chatInput.fill("Test markup");
    await chatInput.press("Enter");

    const chatLog = page.getByRole("log");
    await expect(chatLog).toContainText("après");
    await expect(chatLog).not.toContainText(/function=/i);
    await expect(chatLog).not.toContainText("save_lead");
  });
});
