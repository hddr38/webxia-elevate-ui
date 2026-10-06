import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers";

const DAY_MS = 86_400_000;
const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

function mockAdminAuth(page: Page) {
  const fakeSession = {
    access_token: [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      "e2e",
      btoa(
        JSON.stringify({
          sub: "00000000-0000-4000-8000-000000000000",
          role: "authenticated",
        }),
      ),
    ].join("."),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "e2e-refresh-token",
    user: {
      id: "00000000-0000-4000-8000-000000000000",
      aud: "authenticated",
      role: "authenticated",
      email: "e2e@webxia.test",
      email_confirmed_at: new Date().toISOString(),
      phone: "",
      confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  const cookieValue =
    "base64-" +
    btoa(JSON.stringify(fakeSession)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  page.route("**/auth/v1/token*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Set-Cookie": `sb-sogswkolqbyjdbycwvqx-auth-token=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; SameSite=Lax`,
      },
      body: JSON.stringify(fakeSession),
    }),
  );
}

const MOCK_LEADS = {
  data: [
    {
      id: "11111111-2222-4333-8444-555555555566",
      session_id: "sess-001",
      conversation_id: "conv-001",
      first_name: "Jean",
      email: "jean@example.com",
      phone: "+33612345678",
      summary:
        "Besoin d'un site vitrine pour une boulangerie artisanale à Lyon. Budget 3000-5000€.",
      metadata: { source: "chat", intent: "site_vitrine" },
      created_at: isoDaysAgo(3),
    },
    {
      id: "22222222-3333-4444-9555-666666666677",
      session_id: "sess-002",
      conversation_id: "conv-002",
      first_name: "Marie",
      email: "marie@startup.io",
      phone: null,
      summary: "Projet e-commerce mode éthique. Besoin paiement Stripe, gestion stock.",
      metadata: { source: "chat", intent: "ecommerce" },
      created_at: isoDaysAgo(2),
    },
    {
      id: "33333333-4444-5555-0666-777777777788",
      session_id: "sess-003",
      conversation_id: null,
      first_name: "Pierre",
      email: null,
      phone: "+33789012345",
      summary: "Demande de devis pour refonte site corporate. Secteur B2B services.",
      metadata: { source: "chat", intent: "refonte" },
      created_at: isoDaysAgo(1),
    },
  ],
  total: 3,
  page: 1,
  limit: 20,
  totalPages: 1,
};

const EMPTY_LEADS = {
  data: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 1,
};

interface ServerFnMocks {
  listLeads?: unknown;
  deleteLead?: unknown;
  failLeads?: boolean;
  onDelete?: () => void;
}

/**
 * Intercepte les server functions (URL réelle `/_serverFn/<hash>`, sans préfixe
 * /api — functionId haché). Dispatch par méthode HTTP : GET = listLeads,
 * POST = deleteLead. Le fetcher TanStack Start lit `result` dans le payload :
 * la réponse doit être enveloppée `{ result: VALUE }` (sans header
 * x-tss-serialized, la branche JSON retourne le body tel quel).
 * `failLeads` renvoie 500 + text/plain (500 + application/json serait lu
 * comme un succès par le fetcher, avant le check `!response.ok`).
 */
async function mockServerFn(page: Page, mocks: ServerFnMocks = {}) {
  await page.route(/\/_serverFn\//, async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      mocks.onDelete?.();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: mocks.deleteLead ?? { success: true } }),
      });
    }
    if (mocks.failLeads) {
      return route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "Internal Server Error",
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: mocks.listLeads ?? MOCK_LEADS }),
    });
  });
}

/**
 * Navigation CLIENT vers /admin/leads : `page.goto` recevrait 403 du
 * adminPathGuardMiddleware (le cookie e2e n'a pas de session admin réelle).
 * Depuis le dashboard hydraté, le clic sur le lien nav ne crée aucun document
 * request — seul beforeLoad client s'exécute.
 */
async function gotoLeadsPage(page: Page) {
  const leadsLink = page
    .getByRole("navigation", { name: "Administration" })
    .getByRole("link", { name: "Leads", exact: true });
  await leadsLink.click();
  await page.waitForURL(/\/admin\/leads/);
  await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
}

test.describe("Admin Leads", () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminAuth(page);
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    // Signal d'hydratation : sans lui le clic "Se connecter" arrive avant les
    // listeners React et la redirection /admin est perdue (flaky).
    await waitForHydration(page);
    await page.getByRole("textbox", { name: "Email" }).fill("e2e@webxia.test");
    await page.getByRole("textbox", { name: "Mot de passe" }).fill("mdp-e2e-valide");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL((url) => url.pathname === "/admin", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Vue d'ensemble" })).toBeVisible();
  });

  test("affiche la liste des leads avec 3 éléments mockés", async ({ page }) => {
    await mockServerFn(page, { listLeads: MOCK_LEADS });

    await gotoLeadsPage(page);

    await expect(page.getByText("Leads capturés via le widget de chat")).toBeVisible();

    const table = page.locator("table");
    await expect(table).toBeVisible();
    const headers = table.locator("thead th");
    await expect(headers).toHaveCount(6);
    await expect(headers).toContainText([
      "Prénom",
      "Email",
      "Téléphone",
      "Résumé",
      "Créé le",
      "Actions",
    ]);

    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(3);

    await expect(rows.nth(0)).toContainText("Jean");
    await expect(rows.nth(0)).toContainText("jean@example.com");
    await expect(rows.nth(0)).toContainText("+33612345678");
    await expect(rows.nth(0)).toContainText("Besoin d'un site vitrine");

    await expect(rows.nth(1)).toContainText("Marie");
    await expect(rows.nth(1)).toContainText("marie@startup.io");
    await expect(rows.nth(1)).toContainText("Projet e-commerce");

    await expect(rows.nth(2)).toContainText("Pierre");
    await expect(rows.nth(2)).toContainText("+33789012345");
  });

  test("filtre date 7 derniers jours", async ({ page }) => {
    await mockServerFn(page, { listLeads: MOCK_LEADS });

    await gotoLeadsPage(page);

    await page.locator('button[aria-label="Période"]').click();
    await page.getByRole("option", { name: "7 derniers jours" }).click();
    await page.waitForURL(/dateRange=last7/);

    await expect(page.locator("table tbody tr")).toHaveCount(3);
  });

  test("clic sur une ligne ouvre le dialog détail", async ({ page }) => {
    await mockServerFn(page, { listLeads: MOCK_LEADS });

    await gotoLeadsPage(page);

    await page.locator("table tbody tr").first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Jean");
    await expect(dialog).toContainText("jean@example.com");
    await expect(dialog).toContainText("+33612345678");
    await expect(dialog).toContainText("Besoin d'un site vitrine pour une boulangerie");
    await expect(dialog).toContainText("ID de session");
    await expect(dialog).toContainText("sess-001");
  });

  test("suppression d'un lead via AlertDialog", async ({ page }) => {
    let deleteCalled = false;
    await mockServerFn(page, {
      listLeads: MOCK_LEADS,
      onDelete: () => {
        deleteCalled = true;
      },
    });

    await gotoLeadsPage(page);

    const deleteButton = page
      .locator("table tbody tr")
      .first()
      .locator('button[aria-label="Supprimer"]');
    await deleteButton.click();

    const alertDialog = page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog).toContainText("Êtes-vous sûr ?");
    await expect(alertDialog).toContainText("Ce lead sera définitivement supprimé.");
    // Fix B2 : le clic Trash ne doit pas ouvrir le dialog détail par-dessus
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    await alertDialog.getByRole("button", { name: "Supprimer", exact: true }).click();

    await expect.poll(() => deleteCalled).toBe(true);
  });

  test("état vide quand aucun lead", async ({ page }) => {
    await mockServerFn(page, { listLeads: EMPTY_LEADS });

    await gotoLeadsPage(page);

    // dateRange=last30 par défaut : variante filtrée tant que les filtres sont actifs
    await expect(page.getByText("Aucun lead ne correspond à vos filtres.")).toBeVisible();

    await page.getByRole("button", { name: "Réinitialiser les filtres" }).first().click();
    await page.waitForURL(/dateRange=all/);

    await expect(page.getByText("Aucun lead capturé")).toBeVisible();
    await expect(
      page.getByText(
        "Les leads apparaissent ici quand les visiteurs partagent leurs coordonnées via le chat.",
      ),
    ).toBeVisible();
  });

  test("erreur de chargement affiche ListErrorBanner", async ({ page }) => {
    await mockServerFn(page, { failLeads: true });

    await gotoLeadsPage(page);

    await expect(page.getByText("Échec du chargement. Réessayez.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible({
      timeout: 15_000,
    });
  });
});
