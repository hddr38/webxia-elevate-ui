# WebXIA — Elevate UI

Site vitrine + admin WebXIA avec agent Webi (RAG, mémoire, skills, orchestrateur).

Stack : React 19 · TanStack Start · TanStack Router · Vite 8 · TypeScript strict · Tailwind 4 · Supabase (Auth, DB, pgvector) · NVIDIA NIM (LLM + embeddings).

## Prérequis

- Node 22 + npm
- Projet Supabase + clés (jamais commitées)
- Clé NVIDIA NIM pour Webi

## Démarrage

```bash
npm ci
cp .env.example .env   # puis renseigner les vraies valeurs en local
npm run dev
```

## Scripts

| Commande            | Usage                                |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Dev Vite                             |
| `npm run build`     | Build prod (inclut typecheck strict) |
| `npm run lint`      | ESLint + Prettier                    |
| `npm run format`    | Fix auto Prettier                    |
| `npm run typecheck` | `tsc --noEmit`                       |
| `npm run test`      | Vitest (329 tests, providers mockés) |

Avant chaque push : `npm run lint && npm run build`.

## Variables d’environnement

Voir `.env.example` (template sans secrets) :

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client + serveur)
- `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement, Server Functions)
- `NVIDIA_NIM_API_KEY`, `NVIDIA_NIM_BASE_URL`, modèles LLM + embeddings
- `AI_FALLBACK_*`, `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_MAX_TOKENS` (optionnel)

Ne jamais commiter `.env`. Transmettre les vraies clés hors Git (mot de passe manager).

## Structure

```
src/
  components/ui/    # shadcn/ui
  components/site/  # site public
  features/         # articles, auth, realisations (admin)
  lib/ai/           # Webi : contracts, providers, memory, RAG, skills, agent, security
  lib/supabase/     # clients admin / server / browser
  routes/           # TanStack Router (admin protégé)
  server/functions/ # Server Functions (seul pont client → serveur)
  stores/           # Zustand (UI), TanStack Query (serveur)
supabase/migrations/
docs/               # architecture, RAG, schéma DB
```

Règles : Server Functions seules pour le RPC, RLS obligatoire, Zod sur toutes les entrées, pas de `any`, pas d’appel LLM réel dans les tests.

## Docs

- `AGENTS.md` — règles d’ingénierie + statuts Webi
- `ARCHITECTURE.md`, `docs/WEBI_ARCHITECTURE.md`, `docs/RAG.md`, `docs/DATABASE_SCHEMA.md`
- `CONTRIBUTING.md` — workflow Git pro (branches, PR, reviews)
