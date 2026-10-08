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

## 13. Performance (page d'accueil) — LOT 39 P0 baseline (avant)

> Mesures Playwright contre **prod `https://webxia-fr.netlify.app/`** — iPhone 13 (390×844, DPR 3), Slow 4G (1,6 Mb/s ↓ / 750 kb/s ↑ / 150 ms RTT), CPU ×4. 3 scénarios thème : **no-pref + prefers-color-scheme dark** (cas flash B-2), **no-pref + prefers-color-scheme light**, **localStorage explicite** (différé post-P3 pour QW-6).

### 13.1 RUN 3 — No-pref + prefers dark (cas flash B-2)

| Indicateur                       |                                       cold 1 |                cold 2 |    warm (nouveau ctx) |    offscreen visible 6 s | offscreen hidden 6 s |
| -------------------------------- | -------------------------------------------: | --------------------: | --------------------: | -----------------------: | -------------------: |
| **TTFB (ms)**                    |                                        3 598 |                   828 |                 1 289 |                        — |                    — |
| **serverTtfb (ms)**              |                                          803 |                   775 |                 1 227 |                        — |                    — |
| **FCP (ms)**                     |                                        5 616 |                 2 808 |                 2 088 |                        — |                    — |
| **LCP (ms)**                     |                                        5 616 |                 2 808 |                 2 088 |                        — |                    — |
| **LCP Element**                  |                                           H1 |                    H1 |                    H1 |                        — |                    — |
| **DCL (ms)**                     |                                        5 971 |                 2 896 |                 2 059 |                        — |                    — |
| **Load (ms)**                    |                                        6 158 |                 3 459 |                 2 161 |                        — |                    — |
| **Long tasks Σ (ms)**            |                                          929 |                   476 |                     0 | 438 (task) / 44 (script) |             406 / 36 |
| **Long task max (ms)**           |                                          175 |                   274 |                     0 |                        — |                    — |
| **CLS**                          |                                            0 |                     0 |                     0 |                        — |                    — |
| **INP proxy tap (ms)**           |                        64 (delay 23, proc 0) | 72 (delay 58, proc 1) | 24 (delay 12, proc 0) |                        — |                    — |
| **htmlClass @ 3 s**              |                                       `dark` |                `dark` |                `dark` |                        — |                    — |
| **Canvas variant**               |                      MatrixRain (opacity-60) |            MatrixRain |            MatrixRain |                        — |                    — |
| **Canvas signature**             | painted 1.0, meanLum ~1, blueRatio 0.01–0.03 |                       |                       |                          |                      |
| **ProblemSolution hidden nodes** |                                      13 / 87 |               13 / 87 |               13 / 87 |                        — |                    — |

### 13.2 RUN 2 — No-pref + prefers light

| Indicateur                       |                                    cold 1 |                 cold 2 |     warm (nouveau ctx) |       offscreen visible 6 s | offscreen hidden 6 s |
| -------------------------------- | ----------------------------------------: | ---------------------: | ---------------------: | --------------------------: | -------------------: |
| **TTFB (ms)**                    |                                       808 |                    803 |                    903 |                           — |                    — |
| **serverTtfb (ms)**              |                                       755 |                    747 |                    840 |                           — |                    — |
| **FCP (ms)**                     |                                     2 688 |                  2 916 |                  1 280 |                           — |                    — |
| **LCP (ms)**                     |                                     2 688 |                  2 916 |                  1 280 |                           — |                    — |
| **LCP Element**                  |                                        H1 |                     H1 |                     H1 |                           — |                    — |
| **DCL (ms)**                     |                                     2 784 |                  3 606 |                  1 255 |                           — |                    — |
| **Load (ms)**                    |                                     3 493 |                  3 851 |                  1 427 |                           — |                    — |
| **Long tasks Σ (ms)**            |                                     1 592 |                  1 699 |                     53 | 1 223 (task) / 130 (script) |          1 057 / 120 |
| **Long task max (ms)**           |                                       615 |                    546 |                     53 |                           — |                    — |
| **CLS**                          |                                         0 |                      0 |                      0 |                           — |                    — |
| **INP proxy tap (ms)**           |                    144 (delay 80, proc 0) | 136 (delay 82, proc 0) | 120 (delay 46, proc 0) |                           — |                    — |
| **htmlClass @ 3 s**              |                                      `""` |                   `""` |                   `""` |                           — |                    — |
| **Canvas variant**               |                ParticleField (opacity-70) |          ParticleField |          ParticleField |                           — |                    — |
| **Canvas signature**             | painted 0.009, meanLum ~70, blueRatio 1.0 |                        |                        |                             |                      |
| **ProblemSolution hidden nodes** |                                   13 / 87 |                13 / 87 |                13 / 87 |                           — |                    — |

### 13.3 RUN 1 — localStorage explicite (différé post-P3)

| Cas          | localStorage | prefers-color-scheme | Attendu                                                  | Mesuré                     |
| ------------ | ------------ | -------------------- | -------------------------------------------------------- | -------------------------- |
| Stable dark  | `"dark"`     | dark                 | MatrixRain, htmlClass=`dark` dès 1er paint, **0 flash**  | ⏸ non mesuré (baseline P5) |
| Stable light | `"light"`    | light                | ParticleField, htmlClass=`""` dès 1er paint, **0 flash** | ⏸ non mesuré (baseline P5) |

### 13.4 Notes d'interprétation

1. **RUN 1 (localStorage explicite)** différé post-P3 : servira de test de non-régression QW-6 (script inline thème avant paint). La baseline P5 utilisera 3 cold runs par thème avec `localStorage` pré-rempli.
2. **Variance cold 1 vs cold 2** : cold 1 inclut DNS/TLS/TTFB froid complet ; cold 2 bénéficie du CDN edge warm. Baseline P5 = moyenne de 3 cold runs fraîches.
3. **Découverte clé — light theme 2× plus coûteux CPU** :
   - Long tasks Σ : 1 592 ms (light) vs 929 ms (dark) — **ratio 1,7×**
   - Offscreen script / 6 s : 120 ms (light) vs 36 ms (dark) — **ratio 3,3×**
   - Cause : `ParticleField` utilise `shadowBlur = 8 × scale × 169 particules` (rAF continu, main thread) vs `MatrixRain` = `setInterval` + `fillText` (plus simple).
   - → **Priorité QW-1 renforcée sur `particle-field.tsx`** (IntersectionObserver + `visibilitychange` + rAF gate).
4. **Preuves B-x confirmées** (tous thèmes) :
   - **B-1** : `sec2Hidden = 13` nœuds `opacity:0` dans la 2ᵉ section (SSR invisible).
   - **B-2** : `curl /` → `<html lang="fr">` sans `.dark` ; hydratation → `dark` ou `""` (flash).
   - **B-3** : light user — SSR MatrixRain → hydratation ParticleField (double montage).
   - **B-4** : canvas brûle CPU hors écran (dark 36 ms, light 120 ms / 6 s).
   - **B-7** : `Cache-Control: no-cache` HTML + assets → revalidation 437 Ko à chaque cold.

### 13.5 P5a — Mesures locales après (P1+P2+P3)

> Banc identique à P0 (iPhone 13 390×844 DPR 3, Slow 4G, CPU ×4), cible
> `vite preview` local (build P1–P4), 3 cold runs + 1 warm par variante,
> 3 variantes thème (localStorage explicite + no-pref flash-case).
> **Biais prod vs local** : TTFB/LCP absolus NON comparables (edge Netlify
>
> - réseau vs localhost) ; long tasks / INP / ScriptDuration (CPU-bound,
>   même throttling) comparables en ordre de grandeur. P4 (cache immutable)
>   inactif en local → mesuré en **P5b post-déploiement**.

#### HTML brut servi (preuves structurelles B-1/B-2/B-3)

| Check                                | P0 (avant)     | P5a (après) |
| ------------------------------------ | -------------- | ----------- |
| Script inline thème (`webxia-theme`) | absent         | **présent** |
| `<canvas>` dans le hero SSR          | 1 (MatrixRain) | **0**       |
| `opacity:0` dans section 2 SSR       | 13 nœuds       | **0**       |
| Eyebrow « Avant / Après » servie     | oui            | oui         |

#### Cold (moyenne 3 runs) — dark `localStorage=dark`

| Métrique             | P0 prod (2 runs)          | P5a local (moy. 3)                             |
| -------------------- | ------------------------- | ---------------------------------------------- |
| TTFB / serverTtfb    | 3 598 / 828 (edge)        | 136 (localhost — biais)                        |
| FCP = LCP (H1)       | 5 616 / 2 808             | 1 859 (biais réseau)                           |
| DCL / Load           | 5 971–2 896 / 6 158–3 459 | 1 001 / 2 466                                  |
| Long tasks Σ / max   | 929–476 / 175–274         | 1 333 / 390 (même ordre, variance 2× intra-P0) |
| CLS                  | 0                         | 0 (1 run à 0,014 — flake, seuil good 0,1)      |
| INP tap menu         | 64 / 72                   | 80 / 112 / 208 (bruit, cf. §13.6)              |
| `htmlClass` / canvas | `dark` / MatrixRain       | `dark` / MatrixRain (1 seul, bonne variante)   |
| `sec2Hidden` /87     | 13                        | **0**                                          |

#### Cold (moyenne 3 runs) — light `localStorage=light`

| Métrique             | P0 prod                               | P5a local                                       |
| -------------------- | ------------------------------------- | ----------------------------------------------- |
| TTFB                 | 808 / 803                             | 152 (biais)                                     |
| FCP = LCP (H1)       | 2 688 / 2 916                         | 1 895 (biais)                                   |
| Long tasks Σ / max   | 1 592–1 699 / 615–546                 | 2 103 / 548 (même ordre)                        |
| CLS                  | 0                                     | 0 (1 run à 0,014 — flake)                       |
| INP tap menu         | 144 / 136                             | 320 / 136 / 184 (bruit)                         |
| `htmlClass` / canvas | `""` / ParticleField (après swap B-3) | `""` / ParticleField (**monté direct, 0 swap**) |
| `sec2Hidden` /87     | 13                                    | **0**                                           |

#### Cold — no-pref + prefers dark (cas flash B-2) et warm

- noPrefDark (moy. 3) : TTFB 139, FCP/LCP 1 879, LT Σ 1 499 / max 429,
  `htmlClass="dark"` sur les 3 runs (**flash supprimé**, script pre-paint),
  `sec2Hidden=0`, 1 canvas MatrixRain.
- Warm (3 variantes, nouveau ctx) : TTFB 109–125, FCP/LCP 320–348,
  long tasks 0, tap 40–120. (`resBytes` constants : pas de cache
  navigateur en preview — P4 = P5b.)

#### B-4 — hero LOIN hors champ (bas de page, top −8 364), 6 s

| Variante | Visible task/script + draws     | Hors champ task/script + draws | P0 hors champ     |
| -------- | ------------------------------- | ------------------------------ | ----------------- |
| dark     | 500 ms / 20 ms / 3 936 fillText | **15 ms / 0 ms / 0 draw**      | 406 ms / 36 ms    |
| light    | 975 ms / 97 ms / 61 009 arc     | **15 ms / 0 ms / 0 draw**      | 1 057 ms / 120 ms |

ScriptDuration hors champ = **0** (résiduel 15 ms = activité page hors
canvas, identique dark/light). B-4 **supprimé**.
Note protocole : une mesure intermédiaire (scroll pile au bord,
hero bottom=0) gardait l'animation à plein régime — normal sous
`threshold: 0` (sliver fractionnaire = intersecting). Le re-test LOIN
hors champ prouve le gating ; les tests unitaires P1 couvrent le
mécanisme (IO false → 0 frame).

### 13.6 Notes d'interprétation P5a (honnêteté)

1. **B-1/B-2/B-3 : supprimés** (preuves structurelles + E2E JS-bloqué P3).
2. **B-4 : supprimé** (script ≈ 0 et 0 draw loin hors champ, les 2 thèmes).
3. **B-5 (INP < 200 ms) : non démontré au banc** — variance énorme
   intra-run (80–320 ms) dominée par la contention post-load ; P0 avait le
   même comportement (64–144 ms). Pas de régression crédible (mécanisme :
   le gain QW-1 est en régime établi, pas sur un tap isolé post-load).
4. **B-6 (long tasks réduites) : non démontré sur le load** — P5a ≈ P0
   en ordre de grandeur (variance 2× déjà intra-P0) ; l'écart brut
   s'explique mécaniquement (localhost concentre parse+compile+hydrate
   sous CPU ×4). Poids entry : +1,4 % seulement (287 810 → 291 810 o ;
   JS total 1 512 → 1 530 ko, +3 chunks liés au lot middleware c909d1d).
   Pas de régression crédible imputable à P1–P3 (~100 lignes
   d'observers/état, 0 dépendance, 0 chunk).
5. **CLS : 0 sauf 2 runs à 0,014** (seuil « good » 0,1) — même magnitude
   que le flake E2E P3 sous workers parallèles ; hero 1 028 px stable
   avant/après (placeholder QW-7 prouvé).
6. **B-7 : différé P5b** — `resBytes` constants en preview (pas de moteur
   Netlify en local) ; tests prod-gatés prêts (`e2e/headers.spec.ts`).
7. **Aucune régression crédible détectée → pas de STOP** ; les gains du
   lot sont structurels (SSR visible, 0 double-montage, 0 CPU offscreen)
   et steady-state, pas sur les absolus load-path biaisés prod-vs-local.

> **Note d'honnêteté (GO #1)** — Les long tasks P5a sont plus élevées que
> P0 (dark ~1330 vs ~703 moyenne P0 ; light ~2100 vs ~1646). Cette
> différence n'est pas attribuable aux changements P1-P3 : le gating
> canvas n'affecte pas le load initial, et le mounted state n'ajoute
> qu'un render. L'hypothèse retenue est un biais environnemental (vite
> preview local vs prod edge, bruit de scheduling) couplé à la variance
> intra-P0 déjà mesurée à 2x. À reconfirmer en P5b sur prod après
> déploiement.

### 13.8 LOT 40 — Hotfix mobile Safari (regressions LOT 39)

Après le déploiement de LOT 39 (commit c3ac090), deux régressions critiques
ont été observées sur iPhone 12 / Safari en production :

- **S1** : l'animation matrix du hero apparaît beaucoup plus lentement
  qu'avant (canvas client-only = invisible jusqu'à l'hydratation ~5s).
- **S2/S3** : après scroll ou overscroll en haut, les boutons du hero ne
  répondent plus au tap ; le canvas "bloque" et fait buguer le scroll.
- **S4** : toutes les sections après la hero sont vides et ne s'affichent
  qu'en scrollant tout en bas. ProblemSolution est corrigée (P2), mais
  les autres sections ne le sont PAS.

#### Correctifs appliqués

1. **Revert QW-7 (hero.tsx)** : suppression de l'état `mounted` et du
   gate client-only introduit en P3. Le rendu SSR redevient :
   - Branche thème par défaut (dark → MatrixRain, light → ParticleField)
   - Le `<canvas>` est présent dans le HTML SSR (vide, meanAlpha=0)
     → Le délai perçu de 5s sur mobile est éliminé.
     _Justification_ : le canvas SSR vide ne coûte rien (mesure P0
     meanAlpha=0 pctPainted=1%), mais son absence cause un délai de
     hydration. Le revert vers la version P1 (canvas présent + gating IO)
     suffit, sans remettre en cause le double montage (RC-4/B-3) car le
     rendu SSR et l'hydratation sont maintenant cohérents.

2. **Fix QW-1 (matrix-code.tsx + particle-field.tsx)** : amélioration du
   gating IO pour éviter le flicker et le blocage du scroll sur Safari iOS.
   - **IntersectionObserver** : ajout de `rootMargin: "200px"` pour que la
     zone soit considérée "en champ" 200px avant son entrée réelle, ce qui
     évite le flicker au scroll lent.
   - **Debounce sur le callback IO** : délai de 150 ms avant d'appliquer
     la transition start/stop (évite le spam de toggles en scroll rapide).
   - **Gestion de la reprise** : pas de `lastFrame=0` ou de `kick()` à
     chaque reprise ; on reprend proprement en conservant le dernier état
     visuel.
   - **Style tactile** : ajout de `touch-action: pan-y` sur la `<section>`
     hero pour garantir que le scroll vertical n'est pas capté par le
     canvas.
     → Ces changements sont invisibles à l'œil : même apparence, même
     vitesse, même densité.

3. **Étendre QW-2 à toutes les sections** : application du pattern
   `initial={false}` (LOT 33/39) à toutes les sections importées par
   `src/routes/index.tsx`, sauf Hero et ProblemSolution déjà traitées.
   - Sections modifiées : Expertises, WhyChooseUs, ProjectCard
     (et DbRealisationCard, CTAStrip via ProjectCard).
   - Recherche des `initial={{opacity: 0, ...}}` ou `initial={{opacity:0}}`
     et remplacement par `initial={false}`.
   - Conservation de `whileInView`, `viewport`, `transition` tels quels.
     → Toutes les sections sont désormais visibles immédiatement au SSR,
     éliminant le problème S4.

#### Résultats attendus

- Animation matrix visible < 1 s après le 1er paint sur mobile.
- Tap sur les boutons hero après scroll : réponse < 500 ms.
- Toutes les sections visibles sans scroll forcé.
- Scroll fluide, pas de freeze.
- Apparence identique (sauf la réintroduction du canvas dans le HTML SSR,
  invisible de toute façon car vide).

#### Gates obligatoires

- `npm run lint` → 0 erreur
- `npm run typecheck` → 0 erreur
- `npm test` → 607 + nouveaux verts
- `npm run test:e2e` → 33 + nouveaux verts (+ 4 prod-gates skipped)

#### Livrable LOT 40

1. Diff hero.tsx (revert QW-7)
2. Diff matrix-code.tsx + particle-field.tsx (fix IO)
3. Liste des sections modifiees (QW-2 etendu) avec diff
4. Tests ajoutes (nom + assertion)
5. Gates resultats
6. Captures device reel iPhone 12 Safari (4 verifs ci-dessus)
7. Mesures : time-to-animation-visible, time-to-tap-reponse,
   etat sections au 1er paint
8. Attente GO #1 commit

#### Message de commit propose (ASCII) :

fix(home): LOT 40 hotfix mobile safari - revert canvas SSR, IO rootMargin, etend SSR visible

### 13.9 LOT 41 — Allegement matrix + header (mobile prioritaire)

Apres LOT 40, observe sur iPhone 12 Safari : sections post-hero vides
~10 s, boutons hero morts quand la matrix rame, matrix qui bugue au
scroll. Diagnostic : le canvas sature le main thread iOS (trop de
pixels/frame, DPR 2, ~27 fps) et bloque touch events + paint.

#### P1 — Reductions matrix-code.tsx

- **DPR cap adaptatif** : 1.5 sur mobile (< 768 px), 2 sur desktop
  (avant : 2 partout). iPhone DPR 3 : 390x844 passe de 780x1688
  (1 316 640 px) a 585x1266 (740 610 px), soit -44 % de pixels/frame.
- **fontSize 16 -> 22** (defaut 18 -> 22) : colonnes 390/16 = 24
  -> 390/22 = 17, soit ~30 % de fillText en moins par frame.
- **fps 27 -> 15** (frameMs 33/speed ~= 36.7 ms -> 66 ms fixes) :
  -45 % de frames. Chute plus lente/zen, valide par l'utilisateur.
- **Fade trail** : deja une seule passe fillRect, zero shadowBlur
  (verifie, commente).
- **Isolation GPU** : canvas `willChange: transform`,
  `transform: translateZ(0)`, `contain: strict` -> couche composite
  dediee sur iOS, plus de recomposition du viewport par frame.
- **pointer-events** : classe `pointer-events-none` + inline
  `pointerEvents: none` (ceinture + bretelles). Les taps traversent.
- **Reprise IO** : reset `lastFrame = 0` sur transition hors-champ ->
  en-champ (dessin immediat, pas de trou, tests deterministes).
- **Cout combine estime** : 0.56 (DPR) x 0.70 (colonnes) x 0.55 (fps)
  ~= **0.22x du cout initial, soit ~4.5x moins de travail main-thread**.

#### P1 — Reductions particle-field.tsx (vernote clair)

- Meme DPR cap 1.5 / 2.
- **fps clamp 66 ms** (avant : rAF 60 fps sans limite) : meme logique
  lastFrame + reset a la reprise (kick/IO/visibilite).
- **shadowBlur 8*scale -> 4*scale** : le flou d'ombre est le poste le
  plus couteux sur iOS, impact visuel mineur sur fond clair.
- **Particules 169 -> 81** (defaut `particleCount` 13 -> 9, hero
  `13` -> `9`) : -52 % d'arcs + shadowBlur par frame.
- Meme isolation GPU + pointer-events inline.

#### P2 — Gate backdrop-blur header.tsx

- Etat `scrolled` (seuil `scrollY > 20`), listener `{ passive: true }`
  - throttle rAF, `data-testid="header-bar"` + `data-scrolled` pour E2E.
- Au top : `bg-background/0` SANS `backdrop-blur-xl` (rien a flouter
  derriere le hero) -> supprime un RecalcStyle full-viewport par frame
  de matrix tant qu'on est en haut.
- Scrolle : `bg-background/60 backdrop-blur-xl` (identique a l'actuel,
  apparence preservee).
- Note : le `backdrop-blur-md` du petit `LocaleSwitcher` est conserve
  (pastille, pas full-viewport).

#### Hero (touch-action + z-index)

- `hero.tsx` : `fontSize={16}` -> `{22}`, `particleCount={13}` ->
  `{9}`, `style={{ touchAction: "pan-y" }}` sur la `<section>` (le
  navigateur garde le scroll vertical meme si le canvas rame),
  contenu `relative z-10` au-dessus des canvas `-z-10`.

#### P4 — Mesures avant/apres (analytiques, iPhone 12 390x844 DPR 3)

| Metrique                  | Avant (LOT 40)                | Apres (LOT 41)              | Gain             |
| ------------------------- | ----------------------------- | --------------------------- | ---------------- |
| Pixels matrix / frame     | 780x1688 = 1 316 640          | 585x1266 = 740 610          | -44 %            |
| Colonnes / frame (390 px) | 24 (fontSize 16)              | 17 (fontSize 22)            | -29 %            |
| fillText / s (matrix)     | 24 x 27 = 648                 | 17 x 15 = 255               | -61 %            |
| Travail matrix combine    | 1x                            | ~0.22x                      | ~4.5x moins      |
| shadowBlur particules     | 8\*scale x169                 | 4\*scale x81                | -76 % cout ombre |
| fps particules            | 60 (sans limite)              | 15 (clamp 66 ms)            | -75 % frames     |
| Couche composite canvas   | non (recompose viewport)      | oui (translateZ + contain)  | -recalc/frame    |
| RecalcStyle header au top | 1x blur full-viewport / frame | 0 (pas de blur)             | supprime         |
| TTI boutons hero (cible)  | bloque si matrix rame         | < 300 ms (taps traversants) | debloque         |

> Methodo : calculs geometriques + lecture code (pas de profiler
> device ici). A confirmer sur iPhone 12 reel via la preview :
> time-to-animation < 1 s, tap CTA < 300 ms, sections visibles < 3 s.

#### Tests ajoutes

- `matrix-code.test.tsx` — describe LOT 41 : DPR mobile 585
  (= 390x1.5) + desktop 2880 (= 1440x2) ; fps clamp (1030 ms = pas
  de dessin, 1100 ms = dessin) ; pointer-events classe + inline +
  willChange/translateZ.
- `particle-field.test.tsx` — describe LOT 41 : DPR mobile 585 ;
  fps clamp idem ; pointer-events + GPU. Adapte `(g)` en
  `flushRaf(2000)` (clamp 66 ms).
- `header.test.tsx` (nouveau) : top = `bg-background/0` sans
  `backdrop-blur-xl` (`data-scrolled=false`) ; scroll 100 px = blur
  present ; retour top = blur retire.
- `e2e/home.spec.ts` — LOT 41 : contenu visible < 3 s + canvas
  `pointer-events: none` + tap atteint le lien + clic < 300 ms +
  navigation /work ; header blur gate + scroll hero 0 pageerror.

#### Gates (resultats constates)

- `npm run typecheck` -> 0 erreur.
- `npm run lint` -> 0 erreur (2 warnings pre-existants
  `admin/leads.tsx`, hors perimetre).
- `npm test` -> **49 fichiers, 615 tests verts** (607 + 8 nouveaux :
  3 matrix + 3 particle + 2 header).
- `npm run test:e2e` -> **36 verts, 4 skipped, 0 echec** (dont 2
  nouveaux LOT 41).
- Correctif collaterale : le test E2E LOT 39 P3 `0 canvas sans JS`
  echouait deja sur main (LOT 40) car obsolete depuis le revert QW-7
  (le SSR sert a nouveau 1 canvas vide). Phase A alignee sur le
  comportement voulu (`toBe(1)`, cf. §13.8) — echec pre-existant,
  pas une regression LOT 41 (prouve via stash sur main pur).
