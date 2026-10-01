import { expect, test, type Page } from "@playwright/test";

/**
 * Attend l'hydratation React. Le lanceur Webi n'existe PAS dans le HTML SSR :
 * RootComponent ne le rend qu'après hydratation (timer `chatReady`, LOT 31)
 * puis le montage paresseux du chunk ChatWidget. Sa présence dans le DOM
 * prouve donc hydratation + montage React (listeners attachés) — clic sûr.
 *
 * On n'attend PAS `opacity:1` : cette valeur est produite par framer-motion
 * (`delay: 1.2` + duration pilotés par requestAnimationFrame), un signal de
 * rendu, pas d'hydratation, et non déterministe sous charge (LOT 28).
 */
export async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator("[data-webi-launcher]")).toBeAttached();
}

export async function openChat(page: Page): Promise<void> {
  await waitForHydration(page);
  const launcher = page.locator("[data-webi-launcher]");
  await launcher.click();
  await expect(page.getByRole("log")).toBeVisible();
}
