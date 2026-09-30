// LOT 33 — version build-time injectee par Vite `define` (vite.config.ts +
// vitest.config.ts). Vaut le SHA court du commit au build (Netlify COMMIT_REF,
// CI GitHub GITHUB_SHA) et "dev" en local.
declare const __COMMIT_SHA__: string;
