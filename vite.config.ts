import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import type { NetlifyPluginOptions } from "@netlify/vite-plugin";

// LOT 31 — perf: split heavy vendors out of the entry chunk (index-*.js) so
// the critical payload shrinks and vendor chunks can be cached separately.
// Client build only (guarded by isSsrBuild) — the SSR/Nitro bundle keeps its
// default chunking.
// Note: le stack markdown (react-markdown/micromark/…) n'est PAS groupe ici :
// avec manualChunks/rolldown il attirait react/jsx-runtime dans le chunk
// vendor-markdown, ce qui remettait tout le markdown sur le chemin critique
// de chaque page. Sans groupe, il est place par defaut (routes articles +
// ChatWidget uniquement).
function vendorChunk(id: string): string | undefined {
  const normalized = id.replace(/\\/g, "/");
  // LOT 31 - perf: le helper preload de vite (dynamic imports) vit dans le
  // chunk vendor-supabase par defaut, ce qui rendait supabase-js un dep
  // statique de l'entree (preload sur toutes les pages). On le rattache a
  // vendor-react, deja present sur le chemin critique.
  if (normalized.includes("vite/preload-helper")) return "vendor-react";
  const marker = normalized.lastIndexOf("node_modules/");
  if (marker === -1) return undefined;
  const rest = normalized.slice(marker + "node_modules/".length);
  const name = rest.startsWith("@") ? rest.split("/").slice(0, 2).join("/") : rest.split("/")[0];

  if (name === "react" || name === "react-dom" || name === "scheduler") return "vendor-react";
  if (name.startsWith("@tanstack/")) return "vendor-tanstack";
  if (name === "framer-motion" || name === "motion-dom" || name === "motion-utils") {
    return "vendor-motion";
  }
  if (name.startsWith("@supabase/")) return "vendor-supabase";
  if (name.startsWith("@radix-ui/")) return "vendor-radix";
  if (name === "lucide-react") return "vendor-lucide";
  if (name === "sonner") return "vendor-sonner";
  if (name === "zod") return "vendor-zod";
  if (name === "react-hook-form" || name.startsWith("@hookform/")) return "vendor-rhf";
  return undefined;
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    netlify({
      // Deno non installe + projet sans edge functions -> desactive l'emulation Deno
      dev: {
        edgeFunctions: { enabled: false },
        // Le middleware Netlify consomme le body des requêtes POST avant
        // TanStack Start -> casse request.clone() dans le security middleware.
        // En dev, TanStack Start gère les routes directement.
        middleware: false,
      } as NetlifyPluginOptions,
    }),
    react(),
    tailwindcss(),
  ],
  // LOT 33 — version build-time : COMMIT_REF n'existe qu'au build Netlify,
  // pas au runtime des fonctions. On inline le SHA court dans le bundle
  // (client + SSR + dev). Meme define dans vitest.config.ts (obligatoire :
  // -health.test.ts importe le module reel).
  define: {
    __COMMIT_SHA__: JSON.stringify(
      process.env.COMMIT_REF?.slice(0, 7) ?? process.env.GITHUB_SHA?.slice(0, 7) ?? "dev",
    ),
  },
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    tsconfigPaths: true,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  server: { host: true, port: 3000 },
  build: isSsrBuild
    ? undefined
    : {
        rollupOptions: {
          output: { manualChunks: vendorChunk },
        },
      },
}));
