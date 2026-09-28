import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers";

/** Faux payload GoTrue : aucune donnée réelle, aucune écriture en base. */
function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  return {
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
    expires_at: now + 3600,
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
}

function mockAuthFailure(page: Page): Promise<void> {
  return page
    .route("**/auth/v1/token*", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ code: 400, msg: "Invalid login credentials" }),
      }),
    )
    .then(() => undefined);
}

function mockAuthSuccess(page: Page): Promise<void> {
  return page
    .route("**/auth/v1/token*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fakeSession()),
      }),
    )
    .then(() => undefined);
}

async function fillLoginForm(page: Page): Promise<void> {
  await page.getByRole("textbox", { name: "Email" }).fill("e2e@webxia.test");
  await page.getByRole("textbox", { name: "Mot de passe" }).fill("mdp-e2e-valide");
}

test.describe("Administration", () => {
  test("sans session, /admin redirige vers la connexion", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/auth/login", { timeout: 20_000 });

    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    expect(page.url()).toContain("redirect=");
  });

  test("identifiants invalides : message d'erreur générique", async ({ page }) => {
    await mockAuthFailure(page);

    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await page.getByRole("textbox", { name: "Email" }).fill("e2e@webxia.test");
    await page.getByRole("textbox", { name: "Mot de passe" }).fill("mauvais-mdp");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByText("Identifiants incorrects.")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("connexion simulée : accès au tableau de bord", async ({ page }) => {
    await mockAuthSuccess(page);

    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await fillLoginForm(page);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await page.waitForURL((url) => url.pathname === "/admin", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Vue d'ensemble" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Administration" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Articles", exact: true })).toBeVisible();
  });
});
