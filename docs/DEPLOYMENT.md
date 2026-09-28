# WebXIA — Stratégie de déploiement

> **Statut (LOT 26)** : plateforme cible **Netlify**, configuration présente dans
> le dépôt, **site non lié** et **domaine `webxia.fr` non résolu (NXDOMAIN)**.
> Le déploiement automatique n'est pas encore actif — voir « État réel » plus bas.

## 1. Cible

| Élément | Valeur |
| --- | --- |
| Plateforme | Netlify (TanStack Start / Nitro via `@netlify/vite-plugin-tanstack-start`) |
| Build | `npm run build` |
| Publish | `dist/client` |
| Redirects | `/api/*` → `/.netlify/functions/server` (fonction server unique) |
| Config | `netlify.toml` (racine) + plugin Netlify dans `vite.config.ts` |
| Node | 22 (`.nvmrc`) |
| Alternative documentée | Vercel ou Cloudflare Pages (`ARCHITECTURE.md`) — non configurées |

La fonction Netlify générée (`@netlify/vite-plugin server handler`, `path: /*`,
`preferStatic: true`) délégué à `dist/server/server.js` (export `fetch`).

## 2. Environnements

| Environnement | Déclencheur | État |
| --- | --- | --- |
| **preview** | push branche + PR (Netlify Deploy Previews) | ⏳ à activer (liaison du site) |
| **production** | push sur `main` | ⏳ à activer (liaison du site) |
| **staging** | — | non prévu (projet solo : preview = staging) |

Aucun workflow GitHub Actions ne déploie aujourd'hui : `ci.yml` ne fait que
lint / typecheck / test / build.

## 3. Variables d'environnement (noms uniquement)

À renseigner **côté Netlify** (UI : Site configuration → Environment variables),
scoped Production + Deploy previews. Jamais de valeurs dans le dépôt.

### Requises (build + runtime)

| Variable | Usage |
| --- | --- |
| `VITE_SUPABASE_URL` | Client browser + SSR (publié dans le bundle client) |
| `VITE_SUPABASE_ANON_KEY` | Client browser + SSR (publié dans le bundle client) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — client admin, Server Functions |
| `NVIDIA_NIM_API_KEY` | **Server only** — génération Webi |
| `NVIDIA_NIM_BASE_URL` | **Server only** — endpoint NVIDIA NIM |
| `NVIDIA_NIM_DEFAULT_MODEL` | Modèle primaire (nano-omni) |
| `NVIDIA_NIM_FALLBACK_MODEL` | Modèle fallback (lightning) |
| `NVIDIA_NIM_EMBEDDING_MODEL` | Embeddings RAG + `ai_memory` |

### Optionnelles (défauts sains)

| Variable | Défaut / rôle |
| --- | --- |
| `AI_FALLBACK_ENABLED` | `false` — activation du fallback runtime |
| `AI_FALLBACK_PROVIDER` | `nvidia` |
| `AI_TIMEOUT_MS` | `120000` |
| `AI_MAX_RETRIES` | `2` |
| `AI_MAX_TOKENS` | `4096` |
| `CHAT_REQUEST_TIMEOUT_MS` | `110000` — doit rester > budget TTFB LLM (45s) |
| `CHAT_HEARTBEAT_MS` | `15000` — heartbeat SSE anti-déconnexion proxy |

> `VITE_*` = exposé au client par construction. Toute autre variable est
> **server-only**. Ne jamais préfixer un secret par `VITE_`.

## 4. Processus de déploiement

```text
dev  →  branche feat/**|fix/**  →  PR  →  review + CI verte  →  merge main
                                                     │
                                     Netlify : deploy preview (PR)
                                                     │
main ─────────────────────────────────────────────► production
```

1. Localement : `npm run lint && npm run typecheck && npm run test && npm run build`.
2. Push branche → **Deploy Preview Netlify** (une fois le site lié).
3. PR → CI (`ci.yml`) + E2E (`e2e.yml`) verts, 1 approval (CODEOWNERS).
4. Merge `main` → build Netlify (`netlify.toml`) → production.
5. Smoke test manuel/auto sur l'URL de production (voir §6).

**Historique git** : ne jamais réécrire l'historique poussé (contrainte Lovable,
`AGENTS.md`). Push direct sur `main` actuellement possible (aucune protection —
décision documentée `docs/DECISIONS.md`, lot dédié à réactiver).

## 5. Rollback

- **Netlify UI** → Deploys → production deploy précédent → *Publish deploy*.
  Rapide, sans commit.
- **Git** : `git revert <sha>` puis push `main` (jamais de force-push).
- **DB / migrations** : hors périmètre ici — voir `supabase/MIGRATIONS.md`.

## 6. Smoke test

Minimal (exécuté en CI via le serveur Playwright, et après déploiement) :

- `GET /` → `200`, hero rendu.
- `GET /admin` non authentifié → redirection `/auth/login`.
- `GET /api/chat` (POST sans payload) → géré par la fonction serveur (pas de 404).

En production, à exécuter contre l'URL réelle :

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://<domaine>/
curl -fsS -o /dev/null -w "%{http_code}\n" https://<domaine>/admin   # 200 ou 30x
```

## 7. Tests liés au déploiement

| Commande | Rôle |
| --- | --- |
| `npm test` | Vitest unitaire/intégration (433 tests) — requis par CI |
| `npm run test:e2e` | Playwright (accueil, chat mocké, admin) — requis par `e2e.yml` |
| `npm run build` | Build de production (détecte les régressions TS/bundle) |

Les E2E tournent sur un build **preview** local (`webServer` Playwright) : ils
ne nécessitent **aucun secret** (flux chat et auth Supabase mockés côté navigateur,
aucun appel LLM réel).

## 8. Observabilité

- **Logs** : `console.*` côté serveur (Netlify Function logs) + client
  `reportLovableError` (hook Lovable `__lovableEvents`).
- **Health** : `src/server/functions/health.ts` (`health`, `healthDetailed`)
  existe mais **n'est exposé par aucune route** — usage actuellement mort.
- **Métriques** : `src/lib/observability.ts` (TTFT émis par l'event bus).
- **Erreurs runtime** : pas de Sentry/équivalent branché (Option C du LOT 26).

## 9. État réel au LOT 26 (écarts)

| Point | État |
| --- | --- |
| `netlify.toml` + plugin | ✅ commités |
| Site Netlify lié au repo | ❌ (`.netlify/state.json` sans `siteId`) |
| DNS `webxia.fr` | ❌ NXDOMAIN |
| Env vars Netlify | ❌ à renseigner (noms en §3) |
| GitHub Secrets | ❌ inutilisés (CI sans secret) |
| Déploiement auto `main` | ❌ activer après liaison du site |
| Protection branche `main` | ❌ statu quo documenté (`docs/DECISIONS.md`) |
| Health endpoint exposé | ❌ code présent, route absente |
| Sentry / monitoring | ❌ absent |

## 10. Sécurité du déploiement

- `.env` ignoré, `.env.example` en template sans secret — **aucun secret commité**.
- En-têtes sécurité (`Strict-Transport-Security`, CSP, `Permissions-Policy`)
  posés par `src/lib/security/site-headers.ts` + middleware (`src/start.ts`).
- CSRF : `createCsrfMiddleware` sur les Server Functions (`src/start.ts`).
- `/admin` : garde serveur (`adminMiddleware`, 401) + garde client (`beforeLoad`).
- Rotation : clés NVIDIA NIM et `SUPABASE_SERVICE_ROLE_KEY` uniquement via
  l'UI Netlify (jamais dans le dépôt).
