import { expect, test, type Page } from "@playwright/test";

/**
 * Attend l'hydratation React. Le lanceur Webi est rendu côté SSR avec
 * `opacity:0` ; framer-motion ne le passe à 1 qu'après montage du client.
 * Tant que ce n'est pas fait, un clic est perdu (aucun listener React).
 */
export async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator("[data-webi-launcher]")).toHaveCSS("opacity", "1");
}

export async function openChat(page: Page): Promise<void> {
  await waitForHydration(page);
  const launcher = page.locator("[data-webi-launcher]");
  await launcher.click();
  await expect(page.getByRole("log")).toBeVisible();
}
