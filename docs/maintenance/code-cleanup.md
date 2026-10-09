# Protocole d'audit dette technique — WebXIA (Vague 0)

> Audit **non destructif** : détecter sans supprimer. Aucune suppression,
> aucun auto-fix, aucune installation sans accord explicite.

## 1. But

Rendre la dette technique visible et classée (imports, variables, dépendances,
exports, fichiers, duplications) **sans jamais supprimer automatiquement**.
Chaque suppression future est manuelle, relue (`git diff`) et validée par
lint + typecheck + tests + build.

## 2. Baseline (Vague 0, avant tout audit)

```bash
npm run audit:baseline
# = npm run lint && npm run typecheck && npm run test && npm run build
```

Consigner les résultats (verts / rouges, avec logs). Toute vague suivante
rejoue cette baseline et compare.

## 3. Commandes d'audit (lecture seule)

Scripts versionnés (outils déjà installés, aucune dépendance ajoutée) :

```bash
npm run audit:unused:ts      # tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run audit:unused:eslint  # eslint src --rule "@typescript-eslint/no-unused-vars: warn"
```

One-shots non versionnés (outils **non installés**, accord requis avant ajout) :

```bash
npx --yes knip --include dependencies,unlisted,exports,files
npx --yes madge --extensions ts,tsx src --no-spinner
npx --yes jscpd src --format typescript --threshold 5 --reporters console
```

Interdits à cette étape : `--fix`, `--write`, `--delete`, `--prune`,
`--dedupe`, toute option destructive, tout commit/push auto.

## 4. Classification obligatoire de chaque résultat

- `certain` — preuve forte (ex. `tsc --noUnusedLocals` signale un import
  non référencé dans un module sans `import()` dynamique).
- `probable` — signal convergent (ex. Knip + `grep` confirment qu'un
  composant `ui/` n'est importé nulle part).
- `à vérifier` — faux positif possible (routes, `import()` dynamiques,
  shadcn, config, tests, migrations — voir §6).

Aucun élément `probable` ou `à vérifier` ne passe en suppression sans
validation manuelle + `build` vert.

## 5. Zones à ne jamais supprimer automatiquement

`src/routes/**`, `src/routes/api/**`, `src/server/functions/**`,
`src/routeTree.gen.ts` (généré, `@ts-nocheck`), `src/server.ts`,
`src/start.ts`, `src/router.tsx`, `src/lib/supabase/admin.ts`,
`supabase/migrations/**`, `supabase/schema.sql`, `scripts/ingest-knowledge.ts`,
`.env*`, `netlify.toml`, `vite.config.ts`, `vitest.config.ts`,
`package-lock.json`, `bun.lock`, `public/**`, `e2e/**`, `.github/**`,
`knowledge/**`.

## 6. Faux positifs connus (croiser avec Knip avant toute conclusion)

1. **Routes file-based TanStack** : chaque fichier de `src/routes/` est une
   route même sans importeur → déclarés en `entry` dans `knip.json`.
2. **Imports dynamiques** : `src/server/functions/chat.ts` (providers, RAG,
   orchestrateur), `health.ts`, `src/routes/__root.tsx` (ChatWidget,
   AdminHeader, client Supabase, debug-mobile), `src/server.ts`.
3. **Composants shadcn/ui** : `chart`, `carousel`, `command`, `drawer`,
   `input-otp`, `resizable`, `calendar` n'ont qu'un importeur interne —
   c'est normal pour un design system. Le signal utile est
   fichiers/exports, pas dépendances.
4. **Dépendances build/test/déploiement** : `nitro` (runtime interne TanStack
   Start, jamais importé), `lightningcss` (référencé en chaîne dans
   `vite.config.ts`), `tw-animate-css` (importé depuis le CSS) → seuls
   `ignoreDependencies` de `knip.json`, chacun justifié ici.
5. **Scripts RAG** : `scripts/ingest-knowledge.ts` est une entry ; ses
   dépendances (`NVIDIA_NIM_*` via `process.env`) sont hors graphe statique.
6. **Migrations Supabase** : SQL + `schema.sql` jamais analysés (`project`
   limité à `src/`, `supabase/**` ignoré) — audit réservé aux skills
   `supabase` / `supabase-postgres-best-practices`.
7. **Assets publics** : `public/**` ignoré (dont le doublon apparent
   `ChatGPT Ima*.PNG`, à vérifier manuellement).
8. **`netlify.toml`** : hors périmètre Knip (pas de lecture TOML) — relu
   manuellement uniquement.
9. **`e2e/**`** : projet Playwright séparé (secrets requis) ; anomalie
connue : `require("seroval")` sans dépendance déclarée → à vérifier,
   jamais à « corriger » via Knip.

Volontairement **non ignorés** (Knip doit les signaler) : `dotenv`
(usage à vérifier), `date-fns` (chaîne `react-day-picker` à trancher en
Vague 2), `@lovable.dev/vite-tanstack-config`.

## 7. Validation obligatoire après chaque vague

1. `git diff` relu en entier.
2. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`
   verts (ou écarts consignés).
3. Rapport écrit : changements + risques résiduels + éléments restés
   `à vérifier`.

## 8. Stratégie des vagues

- **Vague 0** (ici) : baseline + rapports d'audit classés, zéro suppression.
- **Vague 1** : imports, variables, paramètres, logs `console.log("[Webi]…")`
  manifestement inutiles — preuves `certain` uniquement.
- **Vague 2** : dépendances (`dotenv`, `date-fns`, double lockfile
  `package-lock.json` / `bun.lock` à trancher en équipe) + vérification
  lockfile et build.
- **Vague 3** : exports non référencés, fichiers orphelins (ex. `mappers.ts`
  à vérifier, doublon PNG) — revalidation routes/migrations/scripts/assets
  obligatoire.
- **Vague 4** : duplication (`jscpd`) et complexité (`madge`,
  `orchestrator.ts`, `chat.ts`, RAG) — aucune modification fonctionnelle
  sans test (providers LLM mockés).

## 9. Interdictions

Aucune suppression massive, aucun `eslint --fix`, aucun `tsc` avec écriture,
aucun `npm prune/dedupe`, aucune réécriture de migrations ou d'historique
(contrainte Lovable : pas de force-push sur l'historique partagé).
