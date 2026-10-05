import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openChat } from "./helpers";

/**
 * LOT 38a bis — E2E RÉEL (pas de mock SSE) : valide le déclencheur save_lead
 * (prompt v1.3.1) contre NIM + Supabase réels, puis vérifie la ligne `leads`
 * ET l'événement `lead_created` dans `ai_audit_log`.
 *
 * Exclu du run standard via `testIgnore` (playwright.config.ts) : activer avec
 *   E2E_REAL_NIM=1 npm run test:e2e
 * Les écritures sont réelles (base de prod) : nettoyage en `finally`.
 */
const INPUT_PLACEHOLDER = "Posez votre question";

function readEnvFile(): Record<string, string> {
  const env: Record<string, string> = {};
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

async function poll<T>(
  fn: () => Promise<T | null>,
  timeoutMs: number,
  intervalMs = 2000,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn().catch(() => null);
    if (value) return value;
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

test.describe("E2E réel NIM (@real-nim)", () => {
  test("save_lead crée une ligne leads + un événement lead_created", async ({
    page,
  }: {
    page: Page;
  }) => {
    test.setTimeout(180_000);

    const env = readEnvFile();
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    expect(supabaseUrl, "VITE_SUPABASE_URL absent de .env").toBeTruthy();
    expect(serviceKey, "SUPABASE_SERVICE_ROLE_KEY absent de .env").toBeTruthy();

    const marker = `NimE2E${Date.now()}`;
    const email = `${marker.toLowerCase()}@exemple.fr`;
    const startedAt = Date.now();

    const rest = async (path: string, init?: RequestInit): Promise<Response> => {
      const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: serviceKey as string,
          Authorization: `Bearer ${serviceKey as string}`,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) throw new Error(`REST ${path} -> ${res.status}: ${await res.text()}`);
      return res;
    };

    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await openChat(page);

      const responsePromise = page.waitForResponse(
        (r) => r.url().includes("/api/chat") && r.request().method() === "POST",
        { timeout: 170_000 },
      );

      await page
        .getByPlaceholder(INPUT_PLACEHOLDER)
        .fill(
          `Je m'appelle ${marker}, mon email est ${email}. Je veux un site vitrine pour ma boulangerie.`,
        );
      await page.getByRole("button", { name: "Envoyer" }).click();

      const chatResponse = await responsePromise;
      expect(chatResponse.status()).toBe(200);
      await chatResponse.finished();

      // 1) EXACTEMENT une ligne leads créée (insert immédiat pendant le run)
      const leadsRes = await rest(`leads?first_name=eq.${marker}&select=id,created_at`);
      const leads = (await leadsRes.json()) as Array<{ id: string }>;
      expect(leads.length, `attendu 1 ligne leads pour first_name=${marker}`).toBe(1);

      // 2) message assistant FINAL persisté = confirmation reçue par le
      //    visiteur (un GENERATION_FAILED ne persiste jamais d'assistant).
      const conversationId = await page.evaluate(() =>
        window.localStorage.getItem("webxia-conversation-id"),
      );
      expect(conversationId, "conversationId non adopté par le client").toBeTruthy();
      const assistantRows = await poll(async () => {
        const res = await rest(
          `messages?conversation_id=eq.${conversationId}&role=eq.assistant&select=id,content`,
        );
        const rows = (await res.json()) as Array<{ id: string; content: string }>;
        return rows.length > 0 ? rows : null;
      }, 15_000);
      expect(
        assistantRows,
        "aucun message assistant persisté (confirmation manquante)",
      ).not.toBeNull();

      // 3) EXACTEMENT un événement lead_created (buffer AuditLogger ~5s -> poll)
      const since = new Date(startedAt - 60_000).toISOString();
      const auditCount = await poll(async () => {
        const res = await rest(
          `ai_audit_log?event_type=eq.lead_created&created_at=gte.${since}&select=event_data`,
        );
        const rows = (await res.json()) as Array<{ event_data: { firstName?: string } | null }>;
        const matches = rows.filter((r) => r.event_data?.firstName === marker);
        return matches.length > 0 ? matches.length : null;
      }, 30_000);
      expect(auditCount, "attendu exactement 1 événement lead_created pour ce marqueur").toBe(1);

      // 4) LOT 38a ter — le lead est capturé en base MAIS le jargon interne
      //    est invisible dans l'UI (whitelist USER_VISIBLE_TOOLS, fail-safe).
      const chatLog = page.getByRole("log");
      await expect(chatLog).not.toContainText(/save_lead/i);
      await expect(chatLog).not.toContainText("SAVE_LEAD");
      await expect(chatLog).not.toContainText("leadId");
      await expect(chatLog).not.toContainText("Webi exécute");
    } finally {
      // Cleanup best-effort : la spec écrit en base réelle.
      await rest(`leads?first_name=eq.${marker}`, { method: "DELETE" }).catch(() => undefined);
      const since = new Date(startedAt - 60_000).toISOString();
      await rest(
        `ai_audit_log?event_type=eq.lead_created&created_at=gte.${since}&select=id,event_data`,
      )
        .then(async (res) => {
          const rows = (await res.json()) as Array<{
            id: string;
            event_data: { firstName?: string } | null;
          }>;
          const ids = rows.filter((r) => r.event_data?.firstName === marker).map((r) => r.id);
          if (ids.length > 0) {
            await rest(`ai_audit_log?id=in.(${ids.join(",")})`, { method: "DELETE" });
          }
        })
        .catch(() => undefined);
    }
  });
});
