import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * LOT 26 — E2E de déploiement (smoke).
 *
 * Le `webServer` rebuild le projet puis sert la build de production via
 * `vite preview`, exactement ce que Netlify publie (`dist/client` +
 * fonction serveur). Aucune variable secrète n'est requise : les specs
 * mockent le flux chat (SSE) et l'auth Supabase côté navigateur.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // LOT 38a bis — @real-nim (E2E NIM/Supabase réels) hors run standard :
  // 14/14 exact sans variable ; activer avec E2E_REAL_NIM=1 npm run test:e2e
  testIgnore: process.env.E2E_REAL_NIM ? [] : ["e2e/real-nim.spec.ts"],
  // LOT 38a — plafond 2 workers (aligné CI) : au-delà, 4 Chromium + screencast
  // dépassent la mémoire disponible (16 GB) et le renderer crash
  // ("Target crashed") — exécution parallèle bornée = déterministe (LOT 28).
  workers: 2,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run preview:e2e",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
