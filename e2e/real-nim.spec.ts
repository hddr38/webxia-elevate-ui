import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openChat } from "./helpers";

/**
 * LOT 38a bis/quater — E2E RÉEL (pas de mock SSE) : valide le déclencheur
 * save_lead contre NIM + Supabase réels, avec le tool_choice forcé
 * (FIX K, prompt v1.3.3). Lot 38a quater : 5 runs séquentiels — le trigger
 * doit être DÉTERMINISTE (zéro tolérance, 1/5 échoue = FAIL).
 *
 * Chaque run vérifie : ligne `leads` unique, message assistant persisté
 * (preuve d'un finishReason stop avec contenu), événement `lead_created`,
 * confirmation visible côté visiteur, et l'invisibilité du jargon interne
 * (USER_VISIBLE_TOOLS, LOT 38a ter).
 *
 * Exclu du run standard via `testIgnore` (playwright.config.ts) : activer avec
 *   E2E_REAL_NIM=1 npm run test:e2e
 * Les écritures sont réelles (base de prod) : nettoyage à chaque run + finally.
 */
const INPUT_PLACEHOLDER = "Posez votre question";
const RUNS = 5;

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
  test("save_lead trigger is deterministic (5 consecutive runs)", async ({
    page,
  }: {
    page: Page;
  }) => {
    test.setTimeout(600_000);

    const env = readEnvFile();
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    expect(supabaseUrl, "VITE_SUPABASE_URL absent de .env").toBeTruthy();
    expect(serviceKey, "SUPABASE_SERVICE_ROLE_KEY absent de .env").toBeTruthy();

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

    const cleanupRun = async (marker: string, email: string, startedAt: number): Promise<void> => {
      await rest(`leads?first_name=eq.${marker}`, { method: "DELETE" }).catch(() => undefined);
      // Corrélation email (donnée maîtrisée) en plus du marqueur : le
      // first_name peut être abrégé par le modèle ("Nim").
      await rest(`leads?email=eq.${email}`, { method: "DELETE" }).catch(() => undefined);
      const since = new Date(startedAt - 60_000).toISOString();
      await rest(
        `ai_audit_log?event_type=eq.lead_created&created_at=gte.${since}&select=id,event_data`,
      )
        .then(async (res) => {
          const rows = (await res.json()) as Array<{
            id: string;
            event_data: { firstName?: string; email?: string } | null;
          }>;
          const ids = rows
            .filter(
              (r) =>
                r.event_data?.firstName === marker ||
                (r.event_data?.email ?? "").toLowerCase() === email,
            )
            .map((r) => r.id);
          if (ids.length > 0) {
            await rest(`ai_audit_log?id=in.(${ids.join(",")})`, { method: "DELETE" });
          }
        })
        .catch(() => undefined);
    };

    try {
      for (let run = 1; run <= RUNS; run++) {
        const marker = `NimE2E${Date.now()}J${run}`;
        const email = `${marker.toLowerCase()}@exemple.fr`;
        const startedAt = Date.now();

        try {
          // Conversation fraîche par run : aucune contamination entre runs.
          // Deux clés portent l'état — la synchro manuelle (conversation-id)
          // ET la persistance zustand (webxia-chat: conversationId+sessionId,
          // réhydratée au reload) : sans la seconde, le store garde l'ancienne
          // conversation et le serveur la réutilise (adoption ignorée).
          await page.goto("/", { waitUntil: "domcontentloaded" });
          await page.evaluate(() => {
            window.localStorage.removeItem("webxia-conversation-id");
            window.localStorage.removeItem("webxia-chat");
          });
          await page.reload({ waitUntil: "domcontentloaded" });
          await openChat(page);

          const responsePromise = page.waitForResponse(
            (r) => r.url().includes("/api/chat") && r.request().method() === "POST",
            { timeout: 170_000 },
          );

          const userPrompt = `Je m'appelle ${marker}, mon email est ${email}. Je veux un site vitrine pour ma boulangerie.`;
          await page.getByPlaceholder(INPUT_PLACEHOLDER).fill(userPrompt);
          await page.getByRole("button", { name: "Envoyer" }).click();

          const chatResponse = await responsePromise;
          expect(chatResponse.status(), `run ${run}: /api/chat status`).toBe(200);
          await chatResponse.finished();

          // 1) EXACTEMENT une ligne leads créée. Corrélation sur l'email —
          //    donnée maîtrisée par le test, copiée verbatim par le modèle —
          //    car le first_name est un arg LLM libre qui peut être abrégé
          //    ("Nim" au lieu du marqueur complet, observé en run réel).
          const leadsRes = await rest(`leads?email=eq.${email}&select=id,created_at,first_name`);
          const leads = (await leadsRes.json()) as Array<{ id: string }>;
          expect(leads.length, `run ${run}: attendu 1 ligne leads pour ${email}`).toBe(1);

          // 2) message assistant FINAL persisté avec contenu (un
          //    GENERATION_FAILED ne persiste jamais d'assistant → ce check
          //    prouve un finishReason stop avec content, pas de fail).
          //    L'adoption de conversationId est post-réseau (dernières
          //    frames SSE traitées après response.finished()) : on poll.
          const conversationId = await poll(
            () => page.evaluate(() => window.localStorage.getItem("webxia-conversation-id")),
            10_000,
          );
          expect(conversationId, `run ${run}: conversationId non adopté`).toBeTruthy();
          const assistantRows = await poll(async () => {
            const res = await rest(
              `messages?conversation_id=eq.${conversationId}&role=eq.assistant&select=id,content`,
            );
            const rows = (await res.json()) as Array<{ id: string; content: string }>;
            return rows.length > 0 && rows.every((r) => r.content.trim().length > 0) ? rows : null;
          }, 15_000);
          expect(
            assistantRows,
            `run ${run}: aucun message assistant persisté (confirmation manquante)`,
          ).not.toBeNull();
          const assistantContent = assistantRows![0].content.trim();
          expect(assistantContent.length, `run ${run}: assistant vide`).toBeGreaterThan(0);

          // 3) EXACTEMENT un événement lead_created de niveau skill pour ce
          //    lead — corrélation email + exclusion des audits portant un
          //    `source` (FIX L / item 5 émettent un lead_created additionnel
          //    en plus de celui de la skill pour une même insertion).
          const since = new Date(startedAt - 60_000).toISOString();
          const auditCount = await poll(async () => {
            const res = await rest(
              `ai_audit_log?event_type=eq.lead_created&created_at=gte.${since}&select=event_data`,
            );
            const rows = (await res.json()) as Array<{
              event_data: { email?: string; source?: string } | null;
            }>;
            const matches = rows.filter(
              (r) => (r.event_data?.email ?? "").toLowerCase() === email && !r.event_data?.source,
            );
            return matches.length > 0 ? matches.length : null;
          }, 30_000);
          expect(
            auditCount,
            `run ${run}: attendu exactement 1 événement lead_created pour ${email}`,
          ).toBe(1);

          // 4) confirmation visible par le visiteur dans le transcript.
          //    Le rendu assistant passe par MarkdownContent : on prend un
          //    mot distinct de la demande utilisateur (absent du prompt) et
          //    on l'attend dans le role="log" (preuve que la réponse est
          //    bien rendue, pas seulement persistée). Timeout 15s (le
          //    fallback lightning met plus de temps à streamer), avec
          //    repli sur les mots-clés de confirmation si le modèle a
          //    reformulé (« J'ai bien noté… ») — zéro faux négatif.
          const chatLog = page.getByRole("log");
          const confirmationToken = assistantContent
            .match(/[A-Za-zÀ-ÿ]{4,}/g)
            ?.find((word) => !userPrompt.includes(word));
          expect(
            confirmationToken,
            `run ${run}: aucun mot distinct dans la confirmation persistée`,
          ).toBeTruthy();
          try {
            await expect(chatLog).toContainText(new RegExp(confirmationToken as string, "i"), {
              timeout: 15_000,
            });
          } catch (tokenError) {
            await expect(chatLog)
              .toContainText(/enregistr|recontacter|note vos|bien not/i, {
                timeout: 15_000,
              })
              .catch(() => {
                throw tokenError;
              });
          }

          // 5) LOT 38a ter — jargon interne invisible malgré le tool forcé
          await expect(chatLog).not.toContainText(/save_lead/i);
          await expect(chatLog).not.toContainText("SAVE_LEAD");
          await expect(chatLog).not.toContainText("leadId");
          await expect(chatLog).not.toContainText("Webi exécute");

          console.log(`[real-nim] run ${run}/${RUNS} OK (lead + audit + confirmation)`);
        } finally {
          await cleanupRun(marker, email, startedAt);
        }
      }
    } finally {
      // Backstop : aucun résidu NimE2E ne survit au suite (marqueur OU
      // email de test, y compris les first_name abrégés type "Nim").
      const since = new Date(Date.now() - 30 * 60_000).toISOString();
      await rest(`leads?first_name=ilike.NimE2E%25`, { method: "DELETE" }).catch(() => undefined);
      await rest(`leads?email=ilike.nime2e%25`, { method: "DELETE" }).catch(() => undefined);
      await rest(
        `ai_audit_log?event_type=eq.lead_created&created_at=gte.${since}&select=id,event_data`,
      )
        .then(async (res) => {
          const rows = (await res.json()) as Array<{
            id: string;
            event_data: { firstName?: string; email?: string } | null;
          }>;
          const ids = rows
            .filter((r) => {
              const fn = r.event_data?.firstName ?? "";
              const em = (r.event_data?.email ?? "").toLowerCase();
              return fn.startsWith("NimE2E") || em.startsWith("nime2e");
            })
            .map((r) => r.id);
          if (ids.length > 0) {
            await rest(`ai_audit_log?id=in.(${ids.join(",")})`, { method: "DELETE" });
          }
        })
        .catch(() => undefined);
    }
  });
});
