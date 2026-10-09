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

---

# État de la maintenance — octobre 2026

## 1. Bilan

| Métrique                                            |      Avant |               Après |
| --------------------------------------------------- | ---------: | ------------------: |
| Warnings ESLint                                     |        100 |                  73 |
| Signaux `tsc --noUnusedLocals --noUnusedParameters` |         97 |                  71 |
| Tests Vitest                                        | 630 passés | 638 passés + 1 todo |
| Build client + SSR                                  |       vert |                vert |

- Aucun changement de dépendance, aucun lockfile modifié.
- Aucun fichier de production supprimé.
- Correctifs fonctionnels réalisés : budget RAG (`22e8521`), filtrage des
  tools (`195e245`).

## 2. Correctifs fonctionnels réalisés

### Budget RAG (`22e8521`)

- Le contexte knowledge respecte désormais `maxContextTokens`.
- `truncated` reflète la troncature réelle, plus la pagination des chunks.
- Propagation de configuration du `ContextBuilder` corrigée (des clés
  `undefined` écrasaient ses défauts au spread ; un moteur construit sans
  options recevait un budget `undefined`).
- Marqueur `[TRUNCATED]` réservé dans le budget (plus de dépassement).

### Filtrage des tools (`195e245`)

- `availableTools` filtrée selon les permissions dans `buildAgentContext`.
- `public` visible pour tous ; `authenticated` visible si authentifié.
- `admin` et `internal` masqués en fail closed tant que `isAdmin` n'est
  pas transmis à cette couche (l'orchestrateur ne le fait pas suivre).
- Exécution inchangée, toujours protégée par
  `SkillExecutor.checkPermissions`.

## 3. Politique de classification

| Catégorie                   | Signification                                         | Action                               |
| --------------------------- | ----------------------------------------------------- | ------------------------------------ |
| A — supprimable sans risque | Import/variable morte, sans usage ni effet de bord    | Micro-vague future                   |
| B — paramètre contractuel   | Callback, hook, mock, interface, signature imposée    | Conserver (préfixe selon convention) |
| C — test intentionnel       | Mock, construction ou variable nécessaire au scénario | Conserver                            |
| D — production à relire     | Variable/import/export en module métier sensible      | Revue humaine, ticket                |
| E — faux positif structurel | Route, import dynamique, UI, build, config, asset     | Conserver et documenter              |
| F — dette de design         | Export/barrel/helper sans usage mais structurel       | Décision produit/architecture        |
| G — anomalie réelle         | Dépendance manquante, import invalide, incohérence    | Ticket prioritaire                   |

État : A=55, B=8, C=5, D=4, E=5, F=1, G=0 (78 signaux uniques).
**B, C et E se conservent et se documentent** : ils ne sont jamais une
preuve de suppression.

## 4. Règles de micro-vagues (protocole validé)

1. Une seule intention par commit.
2. Maximum quelques fichiers.
3. Preuve d'absence d'usage avant suppression.
4. Prettier check avant ESLint.
5. Lint, typecheck, tests et build après chaque vague.
6. Commit atomique.
7. Aucun auto-fix global (`--fix`, `--write` interdits).
8. Aucune suppression de dépendance sans build et tests verts.
9. Aucune modification de routes, migrations, imports dynamiques ou
   composants UI sans revue humaine.

## 5. Tickets recommandés

### T1 — Transmettre `isAdmin` au contexte agent

- Objectif : afficher les skills admin aux admins.
- Condition : uniquement lorsqu'une skill admin réelle sera ajoutée.
- Risque : exposition de la définition de skill si mal implémenté.
- Tests : visibilité admin, invisibilité anonyme/authentifié, exécution
  protégée (cas `3c` en `todo` dans `context-permissions.test.ts`).

### T2 — Nettoyer `finalContext` mort dans `buildContext()`

- Objectif : supprimer le calcul inutile restant.
- Condition : après vérification qu'aucun appelant n'en dépend
  (le chemin live passe par `buildBudgetedContextString()`).
- Tests : tests RAG existants et build.

### T3 — Nettoyer les imports morts de l'orchestrateur et du RAG

- Objectif : réduire les signaux TypeScript restants.
- Condition : revue humaine, build et tests obligatoires.
- Risque : modules cœur, imports dynamiques, architecture agent.

### T4 — Nettoyer les imports morts des routes et composants UI

- Objectif : réduire les warnings sans toucher au design system.
- Condition : micro-vagues par fichier, build obligatoire.
- Risque : imports dynamiques, routes TanStack, composants shadcn.

### T5 — Décider du double lockfile npm/Bun

- Objectif : éviter la dérive de versions (`package-lock.json` = référence
  CI, `bun.lock` potentiellement périmé).
- Condition : décision d'équipe.
- Risque : CI npm, développeurs Bun, résolution de dépendances.

### T6 — Documenter les faux positifs structurels

- Objectif : éviter que Knip, ESLint ou TypeScript soient interprétés
  comme une preuve de suppression.
- Éléments : imports dynamiques, routes file-based, composants shadcn,
  dépendances de build, migrations, assets, barrels.
