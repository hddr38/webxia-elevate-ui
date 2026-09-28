import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import type { NetlifyPluginOptions } from "@netlify/vite-plugin";

export default defineConfig({
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
});
