# WebXIA — Stratégie de déploiement

> **Statut (LOT 26)** : plateforme cible **Netlify**, configuration présente dans
> le dépôt, **site non lié** et **domaine `webxia.fr` non résolu (NXDOMAIN)**.
> Le déploiement automatique n'est pas encore actif — voir « État réel » plus bas.

## 1. Cible

| Élément                | Valeur                                                                     |
| ---------------------- | -------------------------------------------------------------------------- |
| Plateforme             | Netlify (TanStack Start / Nitro via `@netlify/vite-plugin-tanstack-start`) |
| Build                  | `npm run build`                                                            |
| Publish                | `dist/client`                                                              |
| Redirects              | `/api/*` → `/.netlify/functions/server` (fonction server unique)           |
| Config                 | `netlify.toml` (racine) + plugin Netlify dans `vite.config.ts`             |
| Node                   | 22 (`.nvmrc`)                                                              |
| Alternative documentée | Vercel ou Cloudflare Pages (`ARCHITECTURE.md`) — non configurées           |

La fonction Netlify générée (`@netlify/vite-plugin server handler`, `path: /*`,
`preferStatic: true`) délégué à `dist/server/server.js` (export `fetch`).

## 2. Environnements

| Environnement  | Déclencheur                                 | État                                        |
| -------------- | ------------------------------------------- | ------------------------------------------- |
| **preview**    | push branche + PR (Netlify Deploy Previews) | ⏳ à activer (liaison du site)              |
| **production** | push sur `main`                             | ⏳ à activer (liaison du site)              |
| **staging**    | —                                           | non prévu (projet solo : preview = staging) |

Aucun workflow GitHub Actions ne déploie aujourd'hui : `ci.yml` ne fait que
lint / typecheck / test / build.

## 3. Variables d'environnement (noms uniquement)

À renseigner **côté Netlify** (UI : Site configuration → Environment variables),
scoped Production + Deploy previews. Jamais de valeurs dans le dépôt.

### Requises (build + runtime)

| Variable                     | Usage                                               |
| ---------------------------- | --------------------------------------------------- |
| `VITE_SUPABASE_URL`          | Client browser + SSR (publié dans le bundle client) |
| `VITE_SUPABASE_ANON_KEY`     | Client browser + SSR (publié dans le bundle client) |
| `SUPABASE_SERVICE_ROLE_KEY`  | **Server only** — client admin, Server Functions    |
| `NVIDIA_NIM_API_KEY`         | **Server only** — génération Webi                   |
| `NVIDIA_NIM_BASE_URL`        | **Server only** — endpoint NVIDIA NIM               |
| `NVIDIA_NIM_DEFAULT_MODEL`   | Modèle primaire (nano-omni)                         |
| `NVIDIA_NIM_FALLBACK_MODEL`  | Modèle fallback (lightning)                         |
| `NVIDIA_NIM_EMBEDDING_MODEL` | Embeddings RAG + `ai_memory`                        |

### Optionnelles (défauts sains)

| Variable                  | Défaut / rôle                                  |
| ------------------------- | ---------------------------------------------- |
| `AI_FALLBACK_ENABLED`     | `false` — activation du fallback runtime       |
| `AI_FALLBACK_PROVIDER`    | `nvidia`                                       |
| `AI_TIMEOUT_MS`           | `120000`                                       |
| `AI_MAX_RETRIES`          | `2`                                            |
| `AI_MAX_TOKENS`           | `4096`                                         |
| `CHAT_REQUEST_TIMEOUT_MS` | `110000` — doit rester > budget TTFB LLM (45s) |
| `CHAT_HEARTBEAT_MS`       | `15000` — heartbeat SSE anti-déconnexion proxy |

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

- **Netlify UI** → Deploys → production deploy précédent → _Publish deploy_.
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

| Commande           | Rôle                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| `npm test`         | Vitest unitaire/intégration (438 tests) — requis par CI                |
| `npm run test:e2e` | Playwright (accueil, chat mocké, admin, health) — requis par `e2e.yml` |
| `npm run build`    | Build de production (détecte les régressions TS/bundle)                |

Les E2E tournent sur un build **preview** local (`webServer` Playwright) : ils
ne nécessitent **aucun secret** (flux chat et auth Supabase mockés côté navigateur,
aucun appel LLM réel).

## 8. Observabilité

- **Logs** : `console.*` côté serveur (Netlify Function logs) + client
  `reportLovableError` (hook Lovable `__lovableEvents`).
- **Health** : `src/server/functions/health.ts` (`health`, `healthDetailed`)
  exposé depuis le **LOT 29** par la route `GET /api/health` — voir « Health
  check » ci-dessous (la route appelle l'export plat `collectHealthSnapshot`,
  même corps que `healthDetailed`).
- **Métriques** : `src/lib/observability.ts` (TTFT émis par l'event bus).
- **Erreurs runtime** : pas de Sentry/équivalent branché (Option C du LOT 26).

### Health check (LOT 29)

| Point           | Valeur                                               |
| --------------- | ---------------------------------------------------- |
| URL             | `https://<site>.netlify.app/api/health`              |
| Méthode         | `GET`                                                |
| Auth            | aucune (public — Option 6A, retour minimal)          |
| Code HTTP       | `200` (`healthy` / `degraded`) · `503` (`unhealthy`) |
| `Cache-Control` | `no-store` (200 **et** 503)                          |

Exemple de retour (JSON minimal — whitelist stricte) :

```json
{
  "status": "healthy",
  "checks": [
    { "name": "db", "status": "ok" },
    { "name": "llm_provider", "status": "ok" },
    { "name": "embeddings", "status": "ok" }
  ],
  "duration_ms": 12,
  "timestamp": "2026-09-28T21:00:00.000Z",
  "version": "105382e"
}
```

- **Normalisation** : `database→db`, `nvidia_provider→llm_provider`,
  `embedding_provider→embeddings` ; statuts `pass→ok`, `warn→degraded`,
  `fail→failed`. Toute clé inconnue est ignorée par construction.
- **Jamais exposé** : `metrics` (contient des identifiants IP sous forme de
  labels), `checks.*.message` (messages d'erreur DB bruts), `uptimeMs`,
  versions de libs, URLs/hosts, config env, stack traces.
- **Implémentation** : `GET` → `handleHealthRequest(request)` →
  `collectHealthSnapshot(request)` (export plat de `health.ts`, identique au
  corps de `healthDetailed`). Un server fn n'est résolvable en build de
  production que s'il est référencé depuis le graph client : une route serveur
  sans composant ne l'est pas — d'où l'export plat, sur le modèle de
  `handleChatRequest` pour `/api/chat`.
- **Usage** : uptime monitor externe (UptimeRobot, Better Stack) → `GET`
  toutes les 5 min, alerte si code ≠ `200`.
- **Limite** : le check DB lit `VITE_SUPABASE_URL` — en CI E2E l'env est
  factice (`e2e-dummy.supabase.co`, injoignable) donc la réponse attendue est
  `503` : c'est le comportement correct (DB indisponible = unhealthy).

## 9. État réel au LOT 26 (écarts)

| Point                     | État                                         |
| ------------------------- | -------------------------------------------- |
| `netlify.toml` + plugin   | ✅ commités                                  |
| Site Netlify lié au repo  | ❌ (`.netlify/state.json` sans `siteId`)     |
| DNS `webxia.fr`           | ❌ NXDOMAIN                                  |
| Env vars Netlify          | ❌ à renseigner (noms en §3)                 |
| GitHub Secrets            | ❌ inutilisés (CI sans secret)               |
| Déploiement auto `main`   | ❌ activer après liaison du site             |
| Protection branche `main` | ❌ statu quo documenté (`docs/DECISIONS.md`) |
| Health endpoint exposé    | ❌ code présent, route absente               |
| Sentry / monitoring       | ❌ absent                                    |

## 10. Sécurité du déploiement

- `.env` ignoré, `.env.example` en template sans secret — **aucun secret commité**.
- En-têtes sécurité (`Strict-Transport-Security`, CSP, `Permissions-Policy`)
  posés par `src/lib/security/site-headers.ts` + middleware (`src/start.ts`).
- CSRF : `createCsrfMiddleware` sur les Server Functions (`src/start.ts`).
- `/admin` : garde serveur (`adminMiddleware`, 401) + garde client (`beforeLoad`).
- Rotation : clés NVIDIA NIM et `SUPABASE_SERVICE_ROLE_KEY` uniquement via
  l'UI Netlify (jamais dans le dépôt).

### Secrets scanning (Netlify) — LOT 30b

- Le stage « secrets scanning » compare **toutes** les valeurs de variables
  d'environnement au build output (indépendamment du flag _Contains secret
  values_). Le premier deploy a donc échoué sur `VITE_SUPABASE_URL` et
  `VITE_SUPABASE_ANON_KEY`, **publiques par construction** : le préfixe
  `VITE_` injecte ces valeurs dans le bundle client, visibles dans les
  devtools.
- Whitelist ciblée dans `netlify.toml` :
  `SECRETS_SCAN_OMIT_KEYS = "VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY"`
  (2 clés publiques uniquement).
- `SUPABASE_SERVICE_ROLE_KEY` et `NVIDIA_NIM_API_KEY` **restent scannés** ;
  `SECRETS_SCAN_ENABLED` reste actif (jamais `false`).
- Alternative sans commit : définir `SECRETS_SCAN_OMIT_KEYS` dans
  _Site settings → Environment variables_ (la valeur UI prime).

## 11. Performance (bundle & Core Web Vitals) — LOT 31

### Baseline (avant, prod `webxia-fr.netlify.app`)

- Payload initial de `/` : **1 296 004 o brut / 370 712 o gzip** (16 assets),
  dont `index-*.js` = **1 035 300 o / 304 314 o gzip** (warning « chunk > 500 kB »).
- Lighthouse **mobile (perf 73)** : FCP 2,9 s · LCP 4,2 s · TBT 210 ms · SI 5,3 s ·
  CLS 0,003 ; a11y 95 · BP 100 · SEO 100.
- Lighthouse **desktop (perf 94)** : FCP 0,9 s · LCP 1,0 s · TBT 20 ms · CLS 0,012.

### Optimisations appliquées (LOT 31)

| Fichier                      | Changement                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/__root.tsx`      | `ChatWidget` + `AdminHeader` en `React.lazy` (chargés après hydration) ; probe session Supabase via `import()` dynamique ; polices Inter réduites à `400;500;600;700` (800/900 jamais utilisés)                   |
| `src/routes/admin/route.tsx` | Client Supabase importé dynamiquement dans `beforeLoad` (la config de route est chargée eager via `routeTree.gen.ts`)                                                                                             |
| `vite.config.ts`             | `build.rollupOptions.output.manualChunks` (vendors react/radix/motion/lucide/sonner/zod/rhf/supabase), helper preload Vite rattaché à `vendor-react`, markdown **non groupé**, tout gardé sous guard `isSsrBuild` |

Choix explicites :

- **Fallback `null`** du `Suspense` chat : le launcher est en `position: fixed`
  (56×56), aucun layout shift possible → `CLS 0` conservé.
- **Markdown non groupé** : avec un groupe `vendor-markdown`, Rolldown y attirait
  `react/jsx-runtime`, ce qui remettait les ~47 ko gzip de markdown sur le
  chemin critique de _toutes_ les pages. Sans groupe, le stack markdown
  (`lib-*.js`) n'est chargé que par ChatWidget + les routes articles.
- **Helper `vite/preload-helper`** rattaché à `vendor-react` : par défaut il
  tombait dans `vendor-supabase-*`, ce qui rendait supabase-js un dépendance
  _statique_ de l'entree (préchargé sur chaque page).

### Mesures (après, build local `vite build` + `vite preview`)

| Indicateur                 | Avant                   | Après                  | Δ                       |
| -------------------------- | ----------------------- | ---------------------- | ----------------------- |
| Payload initial `/` (brut) | 1 296 004 o             | **912 209 o**          | −30 %                   |
| Payload initial `/` (gzip) | 370 712 o               | **264 198 o**          | −29 %                   |
| Assets préchargés          | 16                      | **11**                 | −5                      |
| `index-*.js` (brut)        | 1 035 300 o             | **287 810 o**          | −72 %                   |
| `index-*.js` (gzip)        | 304 314 o               | **86 265 o**           | −72 %                   |
| Plus gros chunk JS         | 1 035 300 o             | 287 810 o              | warning 500 kB supprimé |
| CSS (inchangé)             | 124 350 o / 19 954 o gz | idem                   | —                       |
| JS total client            | 60 fichiers / 1 476 ko  | 58 fichiers / 1 512 ko | découpage redistribué   |

Reste sur le chemin critique : `vendor-react` (react-dom), `vendor-radix`,
`vendor-motion` (contient `react/jsx-runtime` — placement Rolldown non maîtrisé,
mais déjà préchargé pour Framer Motion), `vendor-lucide`, `vendor-sonner`,
`routes-*`.

### Recommandations (post-déploiement)

1. Mesurer **Lighthouse mobile/desktop sur la prod** (avant/après) — voir
   baseline §11 plus haut ; refaire après chaque gros lot UI.
2. Découper `vendor-radix` (108 ko) en réduisant les imports de primitives
   inutilisées.
3. Sortir `recharts` (mort, seul `ui/chart.tsx` l'importe) et `input-otp`
   (0 référence) — **lot séparé**, refusé sur LOT 31.
4. Sourcemaps / `reportCompressedSize` : à activer en CI si besoin de budget
   de bundle automatisé (Lighthouse CI ou `size-limit`).

### Vérifications (gates LOT 31)

`npm run lint` · `npm run typecheck` · `npm test` (438/438) ·
`npm run test:e2e` (11/11, dont garde `/admin` avec l'import dynamique).

## 12. Hygiène repo & version — LOT 32

### Fix version (`health.ts`)

- `src/server/functions/health.ts` (retour du server fn `health`) lit
  désormais :
  `process.env.COMMIT_REF?.slice(0, 7) ?? process.env.npm_package_version ?? "unknown"`
  — aligné sur `src/routes/api/health.ts`, qui lisait déjà `COMMIT_REF`.
- **Cause racine constatée** : `GET /api/health` renvoyait déjà
  `version: "unknown"` **malgré** cette lecture de `COMMIT_REF` dans la route :
  `COMMIT_REF` n'est donc **pas exposé au runtime** de la fonction Netlify
  (seulement à l'environnement de build). Le fix appliqué aligne les deux
  chemins, mais **ne suffit pas** : la valeur reste `unknown` tant que la
  variable est absente du runtime.
- **Remédiation prévue LOT 33** : injection **build-time** de la version
  (constante injectée au build depuis `COMMIT_REF`, disponible en env de
  build) puis lecture côté route.
- Vérification post-déploiement :
  `curl https://<site>/api/health` → `version` = SHA court du commit
  (attendu : encore `unknown` tant que le LOT 33 n'est pas fait).

### Dossiers `.agents/` et `.opencode/` (retirés du tracking)

- **106 fichiers** (54 `.agents/` + 52 `.opencode/`) retirés du suivi git via
  `git rm -r --cached` ; les fichiers **restent sur disque** et dans l'historique.
- `.agents/` et `.opencode/` ajoutés au `.gitignore` (l'ancienne règle
  `.opencode/plans/` est englobée).
- **Justification** : skills/commands d'outillage agent = artefacts d'outils
  locaux, pas du code projet. Audit LOT 32 : **aucun** fichier tracké n'y
  référençait (seul `.gitignore` matchait), et **aucun artefact local** n'était
  tracké (`.opencode/node_modules`, `package.json`, `plans/` déjà ignorés via
  `.opencode/.gitignore`).
- **Conséquence assumée** : ces skills ne sont plus visibles d'un clone neuf ni
  de l'éditeur cloud Lovable ; ils restent utilisables localement.
- Aucune modification fonctionnelle : code applicatif, tests et build inchangés
  hors la ligne `health.ts` ci-dessus.
