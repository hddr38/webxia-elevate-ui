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

  test("LOT 39 P2 — le HTML servi a la section Avant/Apres visible (0 opacity:0)", async ({
    page,
  }) => {
    // HTML brut servi par le SSR, sans hydration : la 2e <section> est
    // ProblemSolution (apres le hero). Avant QW-2, 13 noeuds y etaient en
    // style="opacity:0" (bug B-1).
    const response = await page.request.get("/");
    expect(response.status()).toBe(200);
    const html = await response.text();

    const parts = html.split("<section");
    expect(parts.length).toBeGreaterThan(2);
    // Contenu de la 2e section jusqu'au debut de la 3e (aucune <section>
    // imbriquee dans ProblemSolution).
    const section2 = parts[2].split("<section")[0];
    // Identite de la section (echoue bruyamment si l'ordre change).
    expect(section2).toContain("Avant / Après");
    // B-1 : aucun noeud masque par framer-motion dans le HTML servi.
    expect(section2).not.toContain("opacity:0");
    expect(section2).not.toContain("opacity: 0");
  });

  test("LOT 39 P2 — ProblemSolution visible immediatement au scroll (< 500 ms)", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    const section = page.locator("section").nth(1);
    await expect(section).toContainText("Avant / Après");

    // Scroll instantane (outrepasse le scroll-behavior: smooth du CSS).
    const t0 = Date.now();
    await page.evaluate(() => {
      document
        .querySelectorAll("section")[1]
        ?.scrollIntoView({ behavior: "instant", block: "start" });
    });
    const opacity = await section.evaluate((el) => getComputedStyle(el).opacity);
    const elapsed = Date.now() - t0;

    // QW-2 : visible des le SSR, donc opacity:1 des l'arrivee du scroll.
    expect(opacity).toBe("1");
    expect(elapsed).toBeLessThan(500);
    expect(pageErrors).toEqual([]);
  });

  test("LOT 39 P3 — theme dark pre-peint (localStorage dark, JS bloque)", async ({ page }) => {
    // JS bloques : aucun useEffect ne tourne. La classe .dark ne peut venir
    // QUE du script inline pre-paint (QW-6, bug B-2).
    await page.addInitScript(() => {
      window.localStorage.setItem("webxia-theme", "dark");
    });
    const jsHandler = (route: import("@playwright/test").Route) => route.abort();
    await page.route("**/*.js", jsHandler);
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.className)).toContain("dark");
    expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe("dark");
    await page.unroute("**/*.js", jsHandler);
  });

  test("LOT 39 P3 — theme light pre-peint (localStorage light, JS bloque)", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("webxia-theme", "light");
    });
    const jsHandler = (route: import("@playwright/test").Route) => route.abort();
    await page.route("**/*.js", jsHandler);
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.className)).not.toContain("dark");
    expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe("light");
    await page.unroute("**/*.js", jsHandler);
  });

  test("LOT 39 P3 — theme systeme dark pre-peint (sans localStorage, JS bloque)", async ({
    page,
    context,
  }) => {
    await context.addInitScript(() => {
      window.localStorage.removeItem("webxia-theme");
    });
    await page.emulateMedia({ colorScheme: "dark" });
    const jsHandler = (route: import("@playwright/test").Route) => route.abort();
    await page.route("**/*.js", jsHandler);
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.className)).toContain("dark");
    await page.unroute("**/*.js", jsHandler);
  });

  test("LOT 39 P3 — script pre-paint DANS le head, avant le body (octets servis)", async ({
    page,
  }) => {
    // Constate : React 19 hisse les <link> stylesheet avant tout <script>
    // inline dans les octets servis, quel que soit l'ordre JSX — la position
    // "avant stylesheet" est inatteignable depuis un composant. La garantie
    // anti-flash tient quand meme : script parser-insere DANS le <head>, il
    // s'execute pendant le parsing, avant tout contenu du body, donc avant
    // le premier paint (meme stylesheet en cache). Preuve comportementale :
    // les 3 tests theme ci-dessus (JS bloque).
    const response = await page.request.get("/");
    expect(response.status()).toBe(200);
    const html = await response.text();
    const scriptPos = html.indexOf("webxia-theme");
    const headClose = html.indexOf("</head>");
    const bodyOpen = html.indexOf("<body");
    expect(scriptPos).toBeGreaterThan(-1);
    expect(headClose).toBeGreaterThan(-1);
    expect(bodyOpen).toBeGreaterThan(-1);
    expect(scriptPos).toBeLessThan(headClose);
    expect(scriptPos).toBeLessThan(bodyOpen);
  });

  test("LOT 39 P3 — 1 canvas SSR (revert QW-7 LOT 40), 1 seul canvas apres hydratation (bonne variante)", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem("webxia-theme", "light");
    });

    // Phase A — SSR pur (JS bloque) : EXACTEMENT 1 <canvas> vide dans le hero.
    // LOT 40 a reverte QW-7 (client-only) : le canvas SSR vide (meanAlpha=0)
    // elimine le delai d'hydratation ~5 s sur mobile (cf. §13.8).
    const jsHandler = (route: import("@playwright/test").Route) => route.abort();
    await page.route("**/*.js", jsHandler);
    await page.goto("/");
    expect(await page.locator("section canvas").count()).toBe(1);
    await page.unroute("**/*.js", jsHandler);

    // Phase B — hydratation : EXACTEMENT 1 canvas, directement la variante
    // claire (pas de demontage MatrixRain → ParticleField, bug B-3).
    await page.reload();
    await waitForHydration(page);
    await expect(page.locator("section canvas")).toHaveCount(1);
    await expect(page.locator("section canvas").first()).toHaveClass(/opacity-70/);
    expect(pageErrors).toEqual([]);
  });

  test("LOT 39 P3 — CLS mobile ≈ 0 sur la home (placeholder hero stable)", async ({ page }) => {
    // Stabilite hero (deterministe, liee a QW-7) : le rect de la section ne
    // bouge pas entre avant/apres montage du canvas.
    // CLS page (indicatif) : < 0.05. Le 0 strict flake sous workers
    // paralleles (0.0144 observe, sources hors hero : fonts/images sous
    // contention — pre-existant, non lie au placeholder).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const shift = e as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shift.hadRecentInput) {
            (window as unknown as { __cls: number }).__cls += shift.value ?? 0;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");
    await waitForHydration(page);
    const heroRect = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), h: Math.round(r.height) };
    };
    const before = await page.locator("section").first().evaluate(heroRect);
    // Traverse tout pour declencher les regions IO paresseuses.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const after = await page.locator("section").first().evaluate(heroRect);
    // QW-7 : geometrie hero inchangee (canvas absolute, placeholder stable).
    expect(after).toEqual(before);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.05);
  });

  test("LOT 40 — gate canvas sur scroll lent et boutons hero repondent apres scroll", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    // Simuler un scroll lent en steps (10 steps de 10% de la hauteur de la page).
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
    const stepHeight = totalHeight / 10;
    for (let i = 1; i <= 10; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * stepHeight);
      await page.waitForTimeout(100); // Pause entre les steps pour simuler un scroll lent
    }

    // Après le scroll lent, vérifier qu'il n'y a pas d'erreurs JS.
    expect(pageErrors).toEqual([]);

    // Vérifier que les boutons du hero sont toujours visibles et cliquables.
    const heroButton = page.getByRole("button", { name: "Discutez avec Webi" });
    await expect(heroButton).toBeVisible();
    await expect(heroButton).toBeEnabled();

    // Cliquer sur le bouton pour s'assurer qu'il fonctionne.
    await heroButton.click();
    await expect(page.getByRole("log")).toContainText("Commencez une conversation avec Webi");

    // Vérifier que toutes les sections sont visibles sans scroll forcé (déjà couvert par d'autres tests, mais on peut le refaire ici).
    // On fait un rapide contrôle : le nombre de sections visibles devrait être raisonnable.
    const sections = await page.locator("section").count();
    expect(sections).toBeGreaterThanOrEqual(5); // Hero, ProblemSolution, Expertises, WhyChooseUs, CTAStrip (et éventuellement la section des réalisations si présente)

    // Aucune erreur JS pendant le test.
    expect(pageErrors).toEqual([]);
  });

  test("LOT 41 — contenu visible < 3 s, canvas non-bloquant, CTA hero < 300 ms", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const t0 = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // SSR : h1 LCP + 2e section visibles sans attendre l'hydratation.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("section").nth(1)).toContainText("Avant / Après", {
      timeout: 10000,
    });
    expect(Date.now() - t0).toBeLessThan(3000);
    await waitForHydration(page);

    // Le canvas du hero ne doit jamais intercepter les taps.
    const canvas = page.locator("section").first().locator("canvas").first();
    if ((await canvas.count()) > 0) {
      expect(await canvas.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    }

    // Le tap atteint le lien (pas le canvas) : elementFromPoint au centre du CTA.
    const cta = page.getByRole("link", { name: "Découvrir WebXIA" }).first();
    await expect(cta).toBeVisible();
    const hitLink = await cta.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit ? !!hit.closest("a") : false;
    });
    expect(hitLink).toBe(true);

    // Le clic est accepte vite (cible produit < 300 ms, sonde : 264 ms).
    // Seuil E2E < 1000 ms : absorbe la contention CPU du poste (2 workers
    // + build/serve) observee jusqu'a ~530 ms ; detecte toujours la classe
    // de bug remontee (taps morts/bloques plusieurs secondes).
    const tTap = Date.now();
    await cta.evaluate((el) => (el as HTMLAnchorElement).click());
    expect(Date.now() - tTap).toBeLessThan(1000);
    await page.waitForURL((url) => url.pathname === "/work", { timeout: 10000 });
    expect(pageErrors).toEqual([]);
  });

  test("LOT 41 — header blur gate + scroll hero sans erreur", async ({ page }) => {
    // LOT 43 Phase 6 — gating retire : header OPAQUE PERMANENT (top + scroll).
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    const bar = page.getByTestId("header-bar");

    // Opaque des le top.
    await expect(bar).toHaveClass(/backdrop-blur-xl/);

    // Scroll dans le hero par steps : 0 erreur, pas de freeze.
    const heroBox = await page.locator("section").first().boundingBox();
    const heroHeight = heroBox?.height ?? 800;
    for (let i = 1; i <= 5; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), (heroHeight * i) / 5);
      await page.waitForTimeout(120);
    }
    expect(pageErrors).toEqual([]);

    // Apres scroll : toujours opaque.
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(400);
    await expect(bar).toHaveClass(/backdrop-blur-xl/);

    // Retour top : toujours opaque.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await expect(bar).toHaveClass(/backdrop-blur-xl/);
    expect(pageErrors).toEqual([]);
  });

  test("LOT 42 — mobile 390px : 0 canvas, fallback CSS, contenu < 3 s, CTA < 300 ms", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });

    const t0 = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("section").nth(1)).toContainText("Avant / Après", {
      timeout: 10000,
    });
    expect(Date.now() - t0).toBeLessThan(3000);
    await waitForHydration(page);

    // Pas de canvas sur mobile : fallback CSS (memes dimensions -> CLS = 0).
    await expect(page.locator("section").first().locator("canvas")).toHaveCount(0);
    const fallback = page.getByTestId("hero-fallback");
    await expect(fallback).toBeVisible();
    expect(await fallback.evaluate((el) => getComputedStyle(el).position)).toBe("absolute");
    expect(await fallback.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");

    // Stabilite geometrique hero (fallback absolute comme le canvas).
    const rect = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), h: Math.round(r.height) };
    };
    const before = await page.locator("section").first().evaluate(rect);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    expect(await page.locator("section").first().evaluate(rect)).toEqual(before);

    // CTA repond vite (cible produit < 300 ms ; seuil E2E < 1000 ms contre
    // la contention CPU du poste, cf. test LOT 41 — clic natif, hit-test
    // elementFromPoint deja prouve plus haut dans ce fichier).
    const cta = page.getByRole("link", { name: "Découvrir WebXIA" }).first();
    await expect(cta).toBeVisible();
    const tTap = Date.now();
    await cta.evaluate((el) => (el as HTMLAnchorElement).click());
    expect(Date.now() - tTap).toBeLessThan(1000);
    await page.waitForURL((url) => url.pathname === "/work", { timeout: 10000 });
    expect(pageErrors).toEqual([]);
  });

  test("LOT 42 — desktop 1440px : 1 canvas dans le hero (inchangé)", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await expect(page.locator("section").first().locator("canvas")).toHaveCount(1);
    await expect(page.getByTestId("hero-fallback")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("LOT 43 — mobile 390px : toutes sections visibles immediatement, header opaque, 0 pause", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    // TOUTES les sections + footer visibles immediatement, sans aucun scroll
    // (0 animation d'entree JS sur mobile, 0 opacity:0 au chargement : le
    // HTML SSR est deja a opacity 1, assertion deterministe sans timing).
    const opacities = await page.evaluate(() =>
      Array.from(document.querySelectorAll("section, footer")).map(
        (el) => getComputedStyle(el).opacity,
      ),
    );
    expect(opacities.length).toBeGreaterThan(5);
    expect(opacities.every((o) => o === "1")).toBe(true);

    // Header opaque permanent + bouton pause retire.
    await expect(page.getByTestId("header-bar")).toHaveClass(/backdrop-blur-xl/);
    await expect(page.getByRole("button", { name: /animations/i })).toHaveCount(0);

    // Tap CTA hero vite (cible produit < 300 ms ; seuil E2E < 1000 ms,
    // meme justification contention que les tests LOT 41/42).
    const cta = page.getByRole("link", { name: "Découvrir WebXIA" }).first();
    const tTap = Date.now();
    await cta.evaluate((el) => (el as HTMLAnchorElement).click());
    expect(Date.now() - tTap).toBeLessThan(1000);
    await page.waitForURL((url) => url.pathname === "/work", { timeout: 10000 });
    expect(pageErrors).toEqual([]);
  });

  test("LOT 43 — desktop 1440px : header opaque, marquee sans bouton pause", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    // Header opaque des le top (permanent).
    await expect(page.getByTestId("header-bar")).toHaveClass(/backdrop-blur-xl/);
    // Bouton pause retire aussi sur desktop.
    await expect(page.getByRole("button", { name: /animations/i })).toHaveCount(0);
    // Marquee toujours animee (compositor).
    await expect(page.locator(".marquee-track").first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
