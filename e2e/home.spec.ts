import { expect, test } from "@playwright/test";
import { openChat, waitForHydration } from "./helpers";

test.describe("Accueil", () => {
  test("rend le hero FR et le lanceur Webi sans erreur JS", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("outils digitaux qui font");
    await expect(page.getByRole("button", { name: "Discutez avec Webi" })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("navigation header vers les réalisations", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await page.locator("header").getByRole("link", { name: "Réalisations" }).first().click();
    await page.waitForURL((url) => url.pathname === "/work");

    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("affiche la page 404 sur une route inconnue", async ({ page }) => {
    const response = await page.goto("/route-inexistante", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(404);

    await expect(page.getByText("404", { exact: true })).toBeVisible();
  });

  test("ouvre le widget Webi", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);

    await expect(page.getByRole("log")).toContainText("Commencez une conversation avec Webi");
  });
});
