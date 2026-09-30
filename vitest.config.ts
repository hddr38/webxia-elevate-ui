import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  // LOT 33 — meme define que vite.config.ts : __COMMIT_SHA__ doit exister
  // dans les tests unitaires (-health.test.ts importe src/routes/api/health).
  define: {
    __COMMIT_SHA__: JSON.stringify(
      process.env.COMMIT_REF?.slice(0, 7) ?? process.env.GITHUB_SHA?.slice(0, 7) ?? "dev",
    ),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
    setupFiles: [],
  },
});
