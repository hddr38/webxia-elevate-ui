# Backlog — WebXIA

> **Origine** : LOT 5.2-pre-a (audit i18n read-only, 2026-10-14), rectifié par LOT 5.2-pre-b
> (correction de trois clés i18n + garde-fou, 2026-10-14).
> **Date de création de tous les items** : `2026-10-14`.
> **Règle** : toute mise en production exige un GO explicite. GO #2 accordé le `2026-10-14` :
> push du commit `4f481dc` (LOT 5.2-pre-b) sur `origin/main`, items **#1** et **#3** passés en
> `résolu en production`.
>
> **Vocabulaire de statut**
>
> - `ouvert` — pas encore traité, ou traitement en cours sans validation finale.
> - `corrigé localement, non commité, non déployé` — le diff existe sur la branche locale
>   `main` et les contrôles du lot sont verts, **mais rien n'est poussé ni visible en
>   production**. Ce statut ne signifie pas « résolu en production ».
> - `résolu en production` — commit poussé sur `origin/main` (hash `4f481dc`) **et** rendu
>   vérifié sur `https://webxia-fr.netlify.app`. Exige une preuve de rendu observée en
>   production ; à défaut, la limite est mentionnée explicitement sur l'item.

---

## Vue d'ensemble

| #   | Priorité | Titre                                                                            | Lot cible     | Statut                                       | Date       |
| --- | -------- | -------------------------------------------------------------------------------- | ------------- | -------------------------------------------- | ---------- |
| 1   | P1       | Audit i18n global — clés manquantes FR/EN (issu LOT 5.2-pre-a)                   | `5.2-pre-b`   | résolu en production                         | 2026-10-14 |
| 2   | P1       | Filtres journal incohérents (boutons ≠ catégories réelles en base)               | `5.3`         | ouvert                                       | 2026-10-14 |
| 3   | P1       | `about.process.subtitle` absent en EN                                            | `5.2-pre-b`   | résolu en production                         | 2026-10-14 |
| 4   | P3       | FloatingCTA `animate-ping` continue hors interaction (I-19)                      | `5.2`         | résolu en production                         | 2026-10-15 |
| 5   | P2       | `backdrop-blur` ×28 statiques (perf à mesurer avant modification) (I-18)         | `5.2`         | ouvert                                       | 2026-10-14 |
| 6   | P3       | Code mort : `ProjectCard`, `src/data/projects.ts`, `src/data/articles.ts` (I-16) | `6.4-b V2`    | résolu en production                         | 2026-10-14 |
| 7   | P2       | Saut hiérarchique `h1` → `h3` sur `/contact` (I-11)                              | `6.3`         | résolu en production                         | 2026-10-15 |
| 8   | P3       | Ancrage footer `/about#realisations` versus section `process` (I-12)             | `6.3`         | résolu en production                         | 2026-10-15 |
| 9   | P3       | FloatingCTA non monté dans l'arborescence (composant obsolète)                   | `6.4-b V2`    | résolu en production                         | 2026-10-15 |
| 10  | P1       | SSR/hydratation animations — 65 éléments `opacity:0` corrigés                    | `5.2-b`       | résolu en production                         | 2026-10-15 |
| 11  | P3       | MotionConfig `reducedMotion="user"` — présent et verrouillé par test             | `N/A`         | résolu                                       | 2026-10-15 |
| 12  | P3       | Dead keys i18n — purge de 47 clés mortes + test marquee (LOT 6.1)                | `6.1`         | résolu en production                         | 2026-10-15 |
| 13  | P3       | Hiérarchie titres `/services` — finding audit (faux positif) verrouillé par test | `6.3`         | faux positif — non applicable                | 2026-10-15 |
| 14  | P3       | `LocaleSwitcher` `aria-label` hardcodé EN — i18n + `role=group`                  | `6.3`         | résolu en production                         | 2026-10-15 |
| 15  | P3       | LOT 6.4-b V1 — exports morts supprimés, symboles internes privatisés             | `6.4-b`       | résolu en production                         | 2026-10-15 |
| 16  | P3       | Purge clé i18n `floating.cta` (FR + EN) — devenue morte après V2-a               | `6.4-b V2`    | résolu en production                         | 2026-10-15 |
| 17  | P3       | `use-mobile.tsx` — orphelin après suppression de `sidebar.tsx` (V6-a)            | `V6-a`        | supprimé                                     | 2026-10-19 |
| 18  | P3       | LOT 6.4-b V3 — barrels morts supprimés + exports `skills` purgés                 | `6.4-b V3`    | corrigé localement                           | 2026-10-15 |
| 19  | P2       | Hero canvas mobile — réactivation avec params allégés + kill-switch              | `6.4-b V3+`   | résolu en production                         | 2026-10-18 |
| 20  | P2       | LOT 6.4-b V4 — IA + observabilité (exports morts AI, observability)              | `6.4-b`       | terminé, poussé                              | 2026-10-18 |
| 21  | P3       | Design/UX-1 — navbar admin isolée, bouton retour ≥44 px, libellé retour i18n     | `Design/UX-1` | corrigé localement, non commité, non déployé | 2026-10-19 |

**Barème de priorité utilisé**

- `P1` — bug fonctionnel constaté sur le site public (lecture du code + vérification de rendu).
- `P2` — signal a11y/SEO ou performance suspecté par l'audit, **mesure requise avant correction**.
  L'audit n'a effectué aucune mesure de performance ni d'impact SEO : ces items ne sont pas
  qualifiés d'impact avéré.
- `P3` — hygiène de code, polish ou nominal non bloquant.

---

## 1 — Audit i18n global — clés manquantes FR/EN (issu LOT 5.2-pre-a)

- **Priorité** : `P1`
- **Lot cible** : `5.2-pre-b`
- **Statut** : `résolu en production` — push `4f481dc` sur `origin/main` le `2026-10-14`,
  vérification Netlify `HTTP 200`.
  **Vérification production admin non réalisée faute de session réelle** : `admin.common.prev`
  et `admin.common.next` n'ont été observées rendues **qu'en local** (session simulée + mocks
  server functions, 10/10 contrôles FR/EN) ; les 3 workflows CI/E2E/Integration sont verts.
- **Date** : `2026-10-14`

**Contexte**

Le dictionnaire unique `src/lib/locale-context.tsx` (bloc `en` l.8-576, bloc `fr` l.577-1149)
expose `t()` avec le fallback `translations[locale][key] ?? String(key)`
(`src/lib/locale-context.tsx`, fonction `t`). Toute clé absente d'une locale est donc **rendue
comme clé brute dans l'UI**. `type Dict = Record<string, string>` ne permet pas au compilateur
de détecter l'asymétrie : `keyof typeof translations.en` se réduit à `string`.

LOT 5.2-pre-a a produit trois listes exhaustives :

- **(a)** utilisées + définies uniquement en FR → **1 clé** : `about.process.subtitle`
  (couverte par l'item **#3** de ce backlog, lot `5.2-pre-b`).
- **(b)** utilisées + définies uniquement en EN → **0 clé**.
- **(c)** utilisées via `t()` + absentes des deux locales → **2 clés** :
  `admin.common.prev`, `admin.common.next`.

**Preuve (état constaté à l'audit LOT 5.2-pre-a)**

- `src/routes/admin/leads.tsx:486` → `prevLabel={t("admin.common.prev")}`
- `src/routes/admin/leads.tsx:487` → `nextLabel={t("admin.common.next")}`
- Aucune occurrence de `admin.common.prev` / `admin.common.next` dans `src/lib/locale-context.tsx`
  à l'audit (grep négatif sur les deux blocs).
- Par contraste, `admin.common.pageOf` est bien défini et utilisé à `:485` et `:488`.

**Portée restante hors item #3**

Seules les 2 clés de la liste (c) relèvent de cet item. Elles sont servies par une route
`/admin/*` protégée : **le rendu admin n'a pas été vérifié en production** — faute de session
réelle, seule une session de test simulée (mocks côté navigateur) a permis de les observer
rendues, en local. Leur correction est validée par le test unitaire **et** par le rendu local,
pas par un rendu observé en production (limite également documentée en section 9 du rapport
5.2-pre-a).

**Traitement LOT 5.2-pre-b — état : résolu en production (`4f481dc`), limite de rendu admin
mentionnée**

1. Appliqué : ajout de `admin.common.prev` / `admin.common.next` dans les deux blocs de
   `src/lib/locale-context.tsx` (FR `Précédent` / `Suivant`, EN `Previous` / `Next`),
   immédiatement après `admin.common.pageOf`, sans toucher aux valeurs existantes.
2. **Non appliqué** (interdit par le GO 5.2-pre-b) : resserrer `type Dict`
   (`type Dict = typeof translations.en` + `satisfies Dict` sur le bloc `fr`) pour que
   l'asymétrie devienne une erreur TypeScript. Reste une recommandation ouverte.
3. Appliqué : ajout de `src/lib/locale-context.test.ts` — parité des ensembles de clés FR/EN
   et contrôle de présence/valeur des trois clés corrigées. Ses limites sont documentées en
   tête de fichier.

---

## 2 — Filtres journal incohérents (boutons ≠ catégories réelles en base)

- **Priorité** : `P1`
- **Lot cible** : `5.3`
- **Statut** : `ouvert`
- **Date** : `2026-10-14`

**Contexte**

Les boutons de filtre de `/journal` sont déclarés en dur et ne correspondent à aucune valeur
possible de `articles.category` :

- `src/routes/journal/index.tsx:38` → `const filters = ["all", "article", "case-study", "news"] as const;`
- `src/routes/journal/index.tsx:44` → `list = filter === "all" ? articles : articles.filter((a) => a.category === filter)`
- `src/lib/mappers.ts:38` → `category: db.category?.[0] ?? "article"`

`articles.category` est un `text[]` libre (`supabase/migrations/006_add_missing_columns.sql:6`,
`supabase/migrations/20260730184318_002_add_public_columns.sql:3`), sans contrainte d'enum. Les
valeurs réellement présentes en base sont `Intelligence artificielle` et `Marketing`. La
comparaison `a.category === filter` ne peut donc jamais être vraie pour les trois filtres non
`all`.

LOT 5.1 a bien ajouté les clés `journal.filter.Intelligence artificielle` et
`journal.filter.Marketing` et introduit `tDynamic("journal.filter", …)` **pour les badges**
(`:111`), mais la ligne `:89` consomme toujours la liste statique de `:38` : elle itère sur
un template `journal.filter.${f}`. Le correctif de libellé LOT 5.1 ne corrige donc pas le
filtrage.

**Preuve — production, vérifiée le 2026-10-14**

`https://webxia-fr.netlify.app/journal` (FR **et** EN, locale forcée via
`localStorage.setItem("webxia-locale", …)` + Chromium) :

| Locale | Filtre        | Cartes affichées |
| ------ | ------------- | ---------------- |
| fr     | Tous          | 2                |
| fr     | Articles      | **0**            |
| fr     | Études de cas | **0**            |
| fr     | Actualités    | **0**            |
| en     | All           | 2                |
| en     | Articles      | **0**            |
| en     | Case studies  | **0**            |
| en     | News          | **0**            |

Résultat : les trois filtres hors « Tous » retournent systématiquement zéro carte,
dans les deux locales. La page publie 2 articles : `/journal/agents-ia-pme-guide-simplifie`
et `/journal/ia-marketing-pme-ce-qui-marche-2026`.

**Correction recommandée (non appliquée)**

1. Dériger `filters` des catégories distinctes réellement présentes dans les données chargées
   (`[...new Set(articles.map(a => a.category))]`), avec `all` en tête.
2. Conserver la fonction `tDynamic("journal.filter", …)` déjà en place pour libeller les
   boutons comme les badges (une seule source de vérité pour le libellé).
3. Bloquer la liste en `string[]` et non en `as const`, pour qu'une nouvelle catégorie en base
   n'exige aucune modification de code.
4. Couvrir par un test E2E : cliquer chaque bouton de filtre et assert `> 0` cartes.

---

## 3 — `about.process.subtitle` absent en EN

- **Priorité** : `P1`
- **Lot cible** : `5.2-pre-b`
- **Statut** : `résolu en production` — push `4f481dc` sur `origin/main` le `2026-10-14`.
  **Preuve** : `https://webxia-fr.netlify.app/about` en locale `en` →
  `contains "about.process.subtitle" = false`, sous-titre EN rendu et
  `documentElement.lang = "en"` ; Netlify `HTTP 200`.
- **Date** : `2026-10-14`

**Contexte**

`about.process.subtitle` existe dans le bloc **FR** de `src/lib/locale-context.tsx` mais était
**absent du bloc EN** à l'audit (asymétrie : 513 clés FR, 512 clés EN, `ONLY_IN_FR = 1`,
`ONLY_IN_EN = 0`). La page `/about` appelle cette clé :

- `src/routes/about.tsx:245` → `t("about.process.subtitle")`

Comme `t()` retombe sur `String(key)`, la valeur littérale `about.process.subtitle` est rendue
comme texte visible en locale `en`.

**Preuve — état constaté AVANT correction (production, vérifiée le 2026-10-14)**

`https://webxia-fr.netlify.app/about`

- locale `fr` : `contains "about.process.subtitle" = false` — aucune clé brute.
- locale `en` : `contains "about.process.subtitle" = true`.
  Contexte extrait du `document.body.innerText` :

```
How we work

about.process.subtitle

— 01
Discovery
...
```

La clé brute apparaît **entre le titre de section et la première étape du process**, exactement
au niveau d'attente d'un sous-titre de section.

**Traitement LOT 5.2-pre-b — état : résolu en production (`4f481dc`)**

La valeur EN a été ajoutée dans le bloc `en` de `src/lib/locale-context.tsx`, immédiatement
après `about.process.title`, dans l'ordre du bloc FR. Aucune valeur existante — FR ou EN —
n'a été modifiée. Poussée sur `origin/main` le `2026-10-14` (GO #2, commit `4f481dc`).

**Preuve — état APRÈS correction, production (push `4f481dc`, vérifiée le 2026-10-14)**

`https://webxia-fr.netlify.app/about`, locale `en` forcée via
`localStorage.setItem("webxia-locale", "en")` **avant** navigation (Playwright) :

- `contains "about.process.subtitle" = false` — **clé brute absente**.
- Sous-titre EN rendu, exactement la valeur du dictionnaire :
  "A simple, transparent and results-driven approach to turn your ideas into high-performing
  digital solutions."
- `documentElement.lang = "en"`, aucune valeur FR résiduelle.
- Balayage FR + EN sur les 7 pages publiques : **0 clé brute** (14 combinaisons).
- Netlify : `GET /` → `HTTP 200`.

La preuve **AVANT** correction, conservée ci-dessus, documente l'état constaté par l'audit
LOT 5.2-pre-a et ne décrit plus l'état actuel du site.

---

## 4 — FloatingCTA `animate-ping` continue hors interaction (I-19)

- **Priorité** : `P3`
- **Lot cible** : `5.2`
- **Statut** : `résolu en production` — commit `0e9a199` (LOT 5.2-a), poussé avec `21a28ac`
  sur `origin/main` le `2026-10-15`.
  **Preuve production** : bundle déployé
  `https://webxia-fr.netlify.app/assets/ChatWidget-AQw8_exg.js` (HTTP 200) →
  `group-hover:animate-ping` = 1, `group-focus-visible:animate-ping` = 1,
  `motion-reduce:animate-none` = 1, **`animate-ping` nu = 0** ; CSS déployé
  `/assets/styles-BaCpWVTQ.css` émet les 3 nouvelles classes de variantes.
  **Note** : le launcher `ChatWidget` est monté post-hydration (Suspense + 150 ms) : absent du
  HTML SSR de `/` (comportement inchangé, `data-webi-launcher` = 0 côté serveur).
  **`FloatingCTA` n'est monté nulle part** dans l'arborescence (constat Phase 0 LOT 5.2,
  cf. item **#9**) — le correctif y est appliqué et verrouillé par test, sans impact runtime.
- **Date** : `2026-10-15`

**Contexte**

L'indicateur « ping » du bouton flottant s'anime en boucle permanente, sans lien avec le
survol, le focus ou la préférence système de réduction des animations. Il tourne en continu sur
toutes les pages où le composant est monté, y compris en arrière-plan et pendant le scroll.

Deux sites partagent exactement le même motif non conditionné :

- `src/components/site/floating-cta.tsx:25` → `<span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-40" />`
- `src/components/chat/ChatWidget.tsx:55` → `<span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-40" />`

**Preuve**

- `src/components/site/floating-cta.tsx:20-29` : le `<span>` est un enfant statique du `<Link>`,
  aucune variante `group-hover:` / `hover:` / `motion-reduce:` n'est appliquée sur la classe.
- Le `<motion.div>` parent (`:12-18`) n'anime qu'`opacity/y/scale` à l'apparition
  (`initial`, `animate`, `transition`), pas la pulsation.
- Décompte `animate-ping` dans `src/**/*.tsx` : **2 occurrences dans le code source**.

**Portée de ce chiffre — occurrences vs instances rendues**

`2` est un décompte d'**occurrences textuelles dans les fichiers source**. Ce n'est pas un
décompte d'**instances réellement rendues à l'exécution** : le nombre d'éléments animés dépend
des composants montés sur la page visitée et de leur nombre d'instanciations. Aucune mesure
d'exécution ni de coût GPU n'a été effectuée par l'audit.

**Traitement LOT 5.2-a — état : résolu en production (`0e9a199`)**

La pulsation a été restreinte au survol/focus du bouton parent et neutralisée sous
`prefers-reduced-motion` : les deux occurrences (`src/components/site/floating-cta.tsx:25` et
`src/components/chat/ChatWidget.tsx:55`) passent de `animate-ping` nu à
`group-hover:animate-ping group-focus-visible:animate-ping motion-reduce:animate-none` (les
parents `<Link>` / `motion.button` portaient déjà `group`). 6 tests unitaires verrouillent le
conditionnement (`src/components/site/floating-cta.test.tsx`,
`src/components/chat/chat-widget.test.tsx`). Aucune suppression d'animation au chargement.

---

## 5 — `backdrop-blur` ×28 statiques (perf à mesurer avant modification) (I-18)

- **Priorité** : `P2`
- **Lot cible** : `5.2`
- **Statut** : `ouvert`
- **Date** : `2026-10-14`

**Contexte**

`backdrop-blur` impose au navigateur une couche de compositing et un flou du plan arrière-plan.
Les 28 occurrences relevées sont **statiques dans le code** — présentes dans les fichiers source
quelle que soit l'état de l'interface. L'impact réel sur le rendu mobile **n'a pas été mesuré** :
il doit l'être avant toute modification, plusieurs de ces effets étant porteurs de la direction
artistique (badges sur visuel, barre de filtres, en-tête).

**Portée de ce chiffre — occurrences vs instances rendues**

`28` est un décompte d'**occurrences textuelles dans les fichiers source de `src/`**, dont 2 qui
sont des assertions de test. Ce chiffre **ne correspond pas au nombre d'instances réellement
rendues à l'exécution** : un même composant peut être monté zéro, une ou plusieurs fois selon
la page, et un composant non monté sur la page visitée ne produit aucune couche. L'audit n'a
effectué **aucune mesure** de temps de rendu, de nombre de couches, de coût GPU ou d'impact SEO.

**Preuve — décompte exact dans `src/`**

Total : **28 occurrences dans le code source** (dont 2 assertions dans
`src/components/site/header.test.tsx`, donc 26 dans le code d'application — encore une fois,
occurrences source, pas instances rendues).

Répartition par variante :

| Classe               | Occurrences |
| -------------------- | ----------- |
| `backdrop-blur-md`   | 16          |
| `backdrop-blur-xl`   | 9           |
| `backdrop-blur` (nu) | 3           |

Répartition par fichier :

| Fichier                                                    | Occurrences |
| ---------------------------------------------------------- | ----------- |
| `src/components/site/project-card.tsx`                     | 8           |
| `src/components/chat/ChatWindow.tsx`                       | 3           |
| `src/components/site/header.tsx`                           | 2           |
| `src/components/site/header.test.tsx`                      | 2 (tests)   |
| `src/features/articles/components/ArticleForm.tsx`         | 2           |
| `src/features/realisations/components/RealisationForm.tsx` | 2           |
| `src/routes/journal/index.tsx`                             | 2           |
| `src/routes/about.tsx`                                     | 2           |
| `src/components/admin/admin-header.tsx`                    | 1           |
| `src/components/admin/cover-hero.tsx`                      | 1           |
| `src/components/site/hero.tsx`                             | 1           |
| `src/components/ui/button.tsx`                             | 1           |
| `src/routes/work/index.tsx`                                | 1           |

**Correction recommandée (non appliquée)**

Mesurer d'abord (Lighthouse/mobile, `Performance` + `Layers` panel) : ne cibler que les
occurrences à fort plan en arrière-plan, et réserver toute suppression aux cas où la mesure
démontre un coût réel.

---

## 6 — Code mort : `ProjectCard`, `src/data/projects.ts`, `src/data/articles.ts` (I-16)

- **Priorité** : `P3`
- **Lot cible** : `6.4-b V2`
- **Statut** : `résolu en production` — commits `d2418d9` (V2-a) puis `a1e5c1d` (V2-b) sur
  `origin/main` le `2026-10-15`, CI/E2E/Integration ✅. **Preuve production** : 3 pages
  vérifiées (`/`, `/about`, `/journal`) → `DbRealisationCard` (liens `/work/`) et `CTAStrip`
  (`py-24`) présents, aucune clé i18n brute, HTTP 200.
- **Date** : `2026-10-14`

**Contexte**

Trois artefacts ne participent à aucun chemin d'exécution : ils gonflent la charge de
maintenance et, pour `src/data/articles.ts`, portent un modèle de données dupliqué par rapport
à la table Supabase `articles`.

**Preuve**

| Artefact                                                  | Usage réel                                                                                                      | Verdict                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `ProjectCard` (`src/components/site/project-card.tsx:12`) | 2 occurrences, **toutes deux dans ce même fichier** (définition l.12 + commentaire l.73). Aucun import externe. | export mort                         |
| `src/data/projects.ts`                                    | 1 occurrence : `src/components/site/project-card.tsx:4` → `import type { Project } from "@/data/projects"`      | type-only, effacé à la construction |
| `src/data/articles.ts`                                    | **0 occurrence** d'import dans tout `src/`                                                                      | fichier mort                        |

Attention de périmètre : le fichier `src/components/site/project-card.tsx` **reste vivant** —
il exporte aussi `CTAStrip`, importé par `src/routes/services.tsx:4`. Seul l'export
`ProjectCard` est mort.

**Correction appliquée (LOT 6.4-b V2, 2026-10-15)**

1. `src/data/projects.ts` — supprimé (0 import de valeur ; seul usage = `import type` effacé
   à la construction, réservé à `ProjectCard`).
2. `src/data/articles.ts` — supprimé (0 import dans `src/` ; journal alimenté par Supabase,
   slugs réels ≠ slugs statiques du fichier).
3. `src/components/site/project-card.tsx` — export `ProjectCard` retiré (0 import externe,
   0 runtime) ; `import type { Project }` devenu orphelin retiré.
4. `DbRealisationCard` et `CTAStrip` **conservés intacts** (montés sur 3 et 7 routes
   respectivement, vérifiés en production sur `/`, `/about`, `/journal`).

---

## 7 — Saut hiérarchique `h1` → `h3` sur `/contact` (I-11)

- **Priorité** : `P2`
- **Lot cible** : `6.3`
- **Statut** : `résolu en production` — push `988131b` sur `origin/main` le `2026-10-15`,
  CI/E2E/Integration ✅, vérification Netlify `HTTP 200`. **Preuve production** : hiérarchie
  servie `h1 → h2 → h2`, puis `h3` footer (`Parlez-nous de votre projet.` → `Prendre rendez-vous`
  → `Envoyez-nous un message` → `Navigation`/`Solutions`/`Contact`), sans saut `h1 → h3`.
- **Date** : `2026-10-14`

**Contexte**

La page `/contact` enchaîne directement un `<h1>` sur des `<h3>` sans niveau `<h2>` intermédiaire.
Le saut de niveau s'écarte de la hiérarchie documentaire attendue par les lecteurs d'écran et
peut nuire à l'interprétation des sections de page par les moteurs de recherche.

**Aucune mesure d'impact SEO n'a été effectuée par l'audit.** L'item est ouvert sur la base de
la structure HTML relevée en production, pas sur la base d'un ranking ou d'un signal observé.

**Preuve — production, vérifiée le 2026-10-14**

`https://webxia-fr.netlify.app/contact`, ordre réel des titres :

| Locale | Ordre relevé                                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| fr     | `H1:Parlez-nous de votre projet.` → `H3:Prendre rendez-vous` → `H3:Envoyez-nous un message` → `H3:Navigation` → `H3:Solutions` → `H3:Contact` |
| en     | `H1:Tell us about your project.` → `H3:Book an appointment` → `H3:Send us a message` → `H3:Navigation` → `H3:Solutions` → `H3:Contact`        |

Aucun `H2` n'est émis sur la page. Les trois derniers `<h3>` proviennent du footer et partagent
le même défaut de départ à `h3`.

**Correction appliquée (LOT 6.3, 2026-10-15)**

Les deux titres de section sont passés en `<h2>` :

- `src/components/ui/booking-calendar.tsx` — `Prendre rendez-vous` : `<h3>` → `<h2>`
  (`BookingCalendar` n'a qu'un seul consommateur, `contact.tsx`, donc le passage est sûr).
- `src/components/site/contact.tsx` — `Envoyez-nous un message` : `<h3>` → `<h2>`.

**Contrôles** — `-lot-6-3-a11y.test.tsx` : h1 unique, aucun saut de titre, `h3` de section
absents. Vérifié sur preview locale : `H1 → H2(Prendre rendez-vous) → H2(Envoyez-nous un
message) → h3(footer)`, FR et EN. Les `h3` du footer (Navigation/Solutions/Contact) sont hors
périmètre de cet item (ils suivent un `h2`, pas un saut depuis le `h1`).

---

## 8 — Ancrage footer `/about#realisations` versus section `process` (I-12)

- **Priorité** : `P3`
- **Lot cible** : `6.3`
- **Statut** : `résolu en production` — push `988131b` sur `origin/main` le `2026-10-15`,
  CI/E2E/Integration ✅, vérification Netlify `HTTP 200`. **Preuve production** : `id="process"`
  présent, footer pointant vers `/about#process`, ancien href `/about#realisations` **absent**
  du footer.
- **Date** : `2026-10-14`

**Contexte**

Le lien footer « Notre méthode » / « Our Method » pointe vers `/about#realisations` alors que
la section « Notre méthode » (contenu `about.process.*`) **ne porte aucun `id`**. L'`id`
`realisations` est porté par la section « Des produits livrés » (contenu `work.*`), rendue de
façon **conditionnelle** (`work.length > 0`). Le lien n'est donc pas « décalé » : il vise une
autre section que celle que son libellé annonce, et cette cible peut disparaître si aucune
réalisation n'est publiée.

**Précision apportée par LOT 6.3** : la description initiale de l'item indiquait que la section
`realisations` « présente le contenu process ». La lecture du code (`src/routes/about.tsx`) et
le relevé de hiérarchie en production contredisent ce point — la section `realisations`
contient bien `work.*`. Le diagnostic corrigé est : libellé « Notre méthode » → cible
`realisations` (mauvaise section, conditionnellement rendue).

**Preuve — production, vérifiée le 2026-10-14**

`https://webxia-fr.netlify.app/about`

- `sectionIds = ["realisations"]` → la section cible **existe bien** (le lien n'est pas cassé).
- `footer a[href*="#"] = ["/about#realisations"]` → cible unique du footer.
- Le contenu de la section est celui du process (`How we work` / `Comment nous travaillons`).

**Correction appliquée (LOT 6.3, 2026-10-15)**

- `src/routes/about.tsx` — la section « Notre méthode » reçoit un `id="process"` **stable**,
  toujours rendue (non conditionnelle).
- `src/components/site/footer.tsx` — l'ancre « Notre méthode » pointe désormais vers
  `/about#process` (et non `/about#realisations`).
- L'`id="realisations"` conditionnel (section réalisations) est **conservé tel quel** : plus
  aucun lien ne le cible après la correction, il ne présente donc plus de risque d'ancre
  cassée. Il reste un ancre optionnelle légitime pour la section réalisations.

**Contrôles** — `-lot-6-3-a11y.test.tsx` : `#process` présent avec son `h2` « Notre méthode »,
href footer = `/about#process`, aucune référence résiduelle à `/about#realisations`. Vérifié
sur preview locale : navigation vers `/about#process` atteint bien la section visible, FR et
EN.

---

## 9 — FloatingCTA non monté dans l'arborescence (composant obsolète)

- **Priorité** : `P3`
- **Lot cible** : `6.4-b V2`
- **Statut** : `résolu en production` — commit `d2418d9` (V2-a) sur `origin/main` le
  `2026-10-15`, CI/E2E/Integration ✅. **Preuve production** : aucune balise CTA flottante
  (position fixe + `animate-ping`) détectée sur `/`, `/about`, `/journal` ; `ChatWidget`
  toujours monté (launcher présent).
- **Date** : `2026-10-15`

**Contexte**

Découvert Phase 0 (audit read-only) du LOT 5.2. Le composant `src/components/site/floating-cta.tsx`
est corrigé (ping conditionnel, LOT 5.2-a) et testé (`src/components/site/floating-cta.test.tsx`),
mais **n'est importé nulle part** dans l'arborescence applicative. Il est remplacé
fonctionnellement par le lanceur `ChatWidget` (monté dans `src/routes/__root.tsx:271`).

**Preuve**

`grep FloatingCTA` sur `src/` → aucune occurrence hors du fichier source lui-même
(`src/components/site/floating-cta.tsx:6` — définition) et de son fichier de test. Aucun import
dans une route, un layout ou un composant.

**Correction appliquée (LOT 6.4-b V2-a, 2026-10-15)**

`src/components/site/floating-cta.tsx` et `src/components/site/floating-cta.test.tsx`
supprimés (commit `d2418d9`). Le launcher `ChatWidget` (monté dans `__root.tsx`) reste le
seul CTA flottant de l'arborescence. La clé i18n `floating.cta` devenue morte est purgée
séparément (item **#16**, commit `a1e5c1d`).

---

## 10 — SSR/hydratation animations — 65 éléments `opacity:0` corrigés

- **Priorité** : `P1`
- **Lot cible** : `5.2-b`
- **Statut** : `résolu en production` — commit `21a28ac` poussé sur `origin/main` le
  `2026-10-15`, vérifié en production le même jour.
  **Preuve production** : `https://webxia-fr.netlify.app` — 8 pages publiques servies en
  `HTTP 200` avec **`opacity:0` = 0** occurrences dans le HTML SSR et un `<h1>` présent sur
  chacune : `/about`, `/journal`, `/work`, `/contact`, `/services`, `/cgu`,
  `/mentions-legales`, `/politique-confidentialite` (balayage identique en local avant push).
  La home `/` était déjà conforme depuis LOT 33/34/43.
- **Date** : `2026-10-15`

**Contexte**

Découvert par l'audit LOT 5 (I-02), confirmé Phase 0 du LOT 5.2. Les 5 pages non-home
(+ 3 pages légales) servaient du contenu essentiel (h1 LCP, cartes, formulaires, pages
entières) à `opacity: 0` dans le HTML rendu côté serveur : le contenu n'apparaissait qu'après
hydratation (blocs `animate`) ou au scroll (blocs `whileInView`), et restait invisible si
JavaScript échouait ou était retardé.

**Traitement LOT 5.2-b — motif appliqué (pattern LOT 43)**

- 15 emplacements de code sur 8 fichiers (`about`, `journal`, `work`, `contact`, `services`,
  `cgu`, `mentions-legales`, `politique-confidentialite`) — ~65 instances rendues (FR).
- Blocs `animate` (heroes, pages légales) → `initial={false}` seul.
- Blocs `whileInView` (grids, cartes, forms) → `initial={false}` + gating
  `isMobile ? undefined` via `useIsMobileViewport`.
- Aucun changement de design visible (durées, easings et distances conservés) ; composants
  déjà gatés LOT 43/33/34 et chat intouchés.

---

## 11 — MotionConfig `reducedMotion="user"` — présent et verrouillé par test

- **Priorité** : `P3`
- **Lot cible** : `N/A` (constat, non modifié dans le LOT 5.2 — décision D-5.2-B)
- **Statut** : `résolu` (constat)
- **Date** : `2026-10-15`

**Contexte**

Découvert Phase 0 du LOT 5.2 : un `MotionConfig reducedMotion="user"` est **déjà monté** dans
`src/routes/__root.tsx:237` (fermé `:278`), englobant le contenu principal (Header, Outlet,
Footer, ChatWidget, Toaster) depuis une version antérieure. Aucun ajout nécessaire.

**Preuve**

3 tests structurels ajoutés dans `src/routes/-__root.test.tsx` (LOT 5.2-a, commit `0e9a199`)
verrouillent : l'import depuis `framer-motion`, l'unicité du provider avec
`reducedMotion="user"`, et son positionnement englobant `main#main-content` + `<Outlet>`.
Limite documentée : le rendu complet de `RootComponent` n'étant pas isolable en node (contexte
TanStack Router + providers + lazy), le test lit le fichier source du module.

---

## 12 — Dead keys i18n — purge de 47 clés mortes + test marquee (LOT 6.1)

- **Priorité** : `P3`
- **Lot cible** : `6.1`
- **Statut** : `résolu en production` — commit `e433832` poussé sur `origin/main` le
  `2026-10-15`. CI ✅ (run 38731923947), E2E ✅ (run 38731923928), Integration ✅ (run
  38731923930). Vérification production Netlify `HTTP 200` + Playwright FR/EN sur `/`,
  `/about`, `/services`, `/journal`, `/work`, `/contact` : aucune des 47 clés supprimées
  n'est visible dans le DOM, aucun token sentinelle de clé brute, contenu services/journal
  et piste marquee (`marquee-track`) intacts. **Vérification production admin non réalisée
  faute de session réelle** : les 20 clés `admin.*` ne sont visibles qu'authentifié.
- **Date** : `2026-10-15`

**Décision D-6-1 (option A)**

Les sources de traduction parallèles sont conservées comme sources dédiées légitimes :

- `src/lib/seo.ts`
- `src/data/services-fr.ts`
- `src/data/services-en.ts`

Seules les clés mortes correspondantes sont purgées du dictionnaire principal. Aucune
migration vers `t()` n'a été réalisée dans ce lot.

**Clés supprimées — 47 au total (parité FR/EN stricte vérifiée)**

| Groupe        | Nb  | Détail                                                                                                                                                                                                                                                                                                                        |
| ------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin.*`     | 20  | `nav.dashboard`, `dashboard.quickStats/totalArticles/totalProjects`, `common.closeMenu/loading`, `articles.filters/loading`, `realisations.filters/loading`, `aiMemory.filters/loading`, `nav.collapseSidebar/expandSidebar`, `breadcrumb.new/edit`, `leads.subtitle/deleteSession/deleteSessionDesc/detail.viewConversation` |
| `seo.*`       | 10  | `seo.{home,about,services,contact,journal}.{title,description}` (remplacées par `src/lib/seo.ts`)                                                                                                                                                                                                                             |
| `service.N.*` | 8   | `service.{1..4}.{title,desc}` (remplacées par `services-fr.ts` / `services-en.ts`)                                                                                                                                                                                                                                            |
| divers        | 7   | `about.stack.title`, `chat.contact.description`, `cta.start`, `footer.tag`, `home.services.cta`, `journal.related`, `trust.badge3`                                                                                                                                                                                            |
| `marquee.*`   | 2   | `marquee.pause`, `marquee.play`                                                                                                                                                                                                                                                                                               |

Soit **47 clés × 2 locales = 94 entrées** supprimées (105 lignes, dont 11 paires sur deux
lignes). Parité stricte vérifiée après purge : 470 clés EN = 470 clés FR.

**Test marquee adapté**

`src/components/site/expertise-marquee.test.tsx` : les assertions négatives qui référençaient
les clés `marquee.pause` / `marquee.play` ont été remplacées (approche 1) par des assertions
sur les textes littéraux FR **et** EN extraits du dictionnaire avant suppression
(`Mettre les animations en pause` / `Pause animations`, `Reprendre les animations` /
`Play animations`). L'intention du test (aucun libellé de pause/play dans le DOM) est préservée.

**Clés explicitement non supprimées (vérifiées vivantes)**

`journal.filter.*`, `work.filter.*`, `admin.leads.filters.*`, `admin.aiMemory.deleteSession`
et `admin.aiMemory.deleteSessionDesc` (utilisées par `admin/ai-memory/index.tsx`) restent
présentes. Aucune source parallèle ni aucun composant n'a été modifié.

---

## 13 — Hiérarchie titres `/services` — finding audit (faux positif) verrouillé par test

- **Priorité** : `P3`
- **Lot cible** : `6.3`
- **Statut** : `faux positif — non applicable` — finding infirmé par vérification de l'ordre
  DOM réel ; **aucune correction de code appliquée** ; test de non-régression ajouté.
- **Date** : `2026-10-15`

**Contexte**

L'audit Phase 0 signalait un saut `h1 → h3` sur `/services` : `h1` (`routes/services.tsx:38`)
suivi d'un `h3` de carte (`services.tsx:99`) « avant » le `h2` de section (`services.tsx:139`).
La hiérarchie **DOM réelle était déjà `h1 → h2 → h3`** : le finding reposait sur l'ordre des
lignes dans le fichier, pas sur l'ordre du DOM rendu.

**Finding infirmé (LOT 6.3)**

L'audit s'appuyait sur l'**ordre des lignes dans le fichier**, pas sur l'**ordre DOM**. Dans le
DOM, chaque section de `<Services />` émet son `h2` (`services.tsx:139`) **avant** les cartes
dont les `h3` (`services.tsx:99`, rendues à la ligne 152). Le relevé de hiérarchie confirme la
séquence correcte : `h1 → h2 → h3 → h2 → h3 …` sur toute la page. **Aucune correction de code
n'est appliquée** (transformer les `h3` de cartes en `h2` ou réordonner le DOM aurait dégradé
une hiérarchie déjà valide).

**Garde-fou ajouté**

`-lot-6-3-a11y.test.tsx` verrouille la hiérarchie : h1 unique, aucun saut de niveau, et le
premier titre après le `h1` est un `h2` (section), jamais un `h3` (carte). Confirmé sur preview
locale FR et EN.

---

## 14 — `LocaleSwitcher` `aria-label` hardcodé EN — i18n + `role=group`

- **Priorité** : `P3`
- **Lot cible** : `6.3`
- **Statut** : `résolu en production` — push `988131b` sur `origin/main` le `2026-10-15`,
  CI/E2E/Integration ✅, vérification Netlify `HTTP 200`. **Déviation assumée** : `role="group"`,
  `aria-label` localisé et `aria-pressed` (voir ci-dessous). **Limite** : la vérification en
  production du libellé FR/EN du `LocaleSwitcher` n'a **pas** été rapportée dans le run de push
  (le HTML servi en SSR est rendu en FR par défaut ; la bascule FR/EN du libellé a été validée
  sur preview locale uniquement).
- **Date** : `2026-10-15`

**Contexte**

Le `LocaleSwitcher` (`src/components/site/header.tsx`) durcissait un `aria-label` en anglais,
codé en dur : ``aria-label={`Switch to ${l.toUpperCase()}`}`` — soit « Switch to FR » /
« Switch to EN ». Le libellé n'était pas traduit (toujours EN) et les deux boutons
n'avaient pas de nom accessible stable en fonction de la locale.

**Correction appliquée (LOT 6.3)**

- Nouvelle clé i18n `header.locale.switch` ajoutée dans les deux blocs de
  `src/lib/locale-context.tsx` : FR « Changer de langue », EN « Switch language » (parité
  stricte 471 = 471).

**Déviation documentée (périmètre étendu au-delà du seul `aria-label`)**

Le correctif dévie volontairement de la cible initiale « seul `aria-label` ». Trois changements
de sémantique ARIA sont appliqués sur le `LocaleSwitcher` (`src/components/site/header.tsx`) :

1. **Ajout de `role="group"`** sur le conteneur, porteur d'un `aria-label` d'action localisé
   (`t("header.locale.switch")`).
2. **Suppression des `aria-label` par bouton** (les `` `Switch to FR` `` / `` `Switch to EN` ``
   hardcodés EN) : le nom accessible de chaque bouton redevient son texte visible « EN » /
   « FR », conforme _Label in Name_.
3. **`aria-pressed` conservé et verrouillé par test** : déjà présent, il rend compte de la
   locale active sur chaque bouton.

**Justification de la déviation** : un `aria-label` générique unique (« Changer de langue » /
« Switch language ») appliqué aux **deux** boutons les aurait rendus **identiques et donc
indistinguables** pour un lecteur d'écran. Le `role="group"` porte l'action commune, tandis que
la distinction entre les deux boutons est laissée à leur texte visible (« EN » / « FR »). Il
s'agit d'une amélioration d'accessibilité intentionnelle ; **aucun changement visuel ni
comportemental** n'est recherché au-delà de la sémantique d'accessibilité.

**Statut** : `résolu en production` (commit `988131b`).

**Contrôles** — `header.test.tsx` : `role=group` + `aria-label` FR par défaut, bascule
FR→EN suivie par l'`aria-label`, absence d'`aria-label` par bouton, `aria-pressed` cohérent.
Vérifié sur preview locale FR et EN (26/26 contrôles verts).

---

## 15 — LOT 6.4-b V1 — exports morts supprimés, symboles internes privatisés

- **Priorité** : `P3`
- **Lot cible** : `6.4-b` (V1 — isolation des exports morts)
- **Statut** : `résolu en production` — push `8903194` sur `origin/main` le `2026-10-15`,
  CI ✅, E2E ✅, Integration ✅. Vérification production Netlify : **12/12 pages FR/EN OK**
  (6 pages publiques × 2 locales, locale forcée via `localStorage["webxia-locale"]`),
  `HTTP 200` sur chacune, **CSS strictement inchangé** (SHA256 identique baseline `0993f61` ↔
  V1 : `styles-BaCpWVTQ.css`), hash JS changé (`index-DRYD--No.js` → `index-CgWIJ1mk.js`),
  **aucune clé i18n brute détectée**. Contrôles ciblés : `/services` (9 h2 ≥ 7 expertises),
  `/journal` (7 filtres + 2 articles), `/about` (`#process` 4 cartes + `#realisations`),
  `/contact` (formulaire + booking).
  **Limites** : (1) **admin non vérifié en production faute de session réelle** ; (2) **réduction
  de bundle marginale** (−1 octet client total) — la valeur principale de V1 est l'hygiène
  source (conformité Knip, zéro nouveau warning), pas la taille de bundle : les exports
  supprimés/privatisés étaient majoritairement effacés par la minification/tree-shaking.
- **Date** : `2026-10-15`

**Contexte**

LOT 6.4-a (audit Knip read-only) a identifié 108 exports morts, 73 types morts et 43 fichiers
morts dans la base de code. LOT 6.4-b V1 traite le premier sous-ensemble isolé et sans risque
runtime : les exports morts et les symboles devenus internes après privatisation. Les vagues
suivantes (fichiers morts, barrels, exports AI/observability, CSS, dépendances) restent hors
périmètre et non autorisées.

**Traitement LOT 6.4-b V1 — commit `8903194`**

12 fichiers modifiés (+26 / −79 lignes) :

- **Exports supprimés** (4) : `createAgentError` et `MemoryTypeFilterSchema` (devenu sans
  usage interne après privatisation), `useChatStoreActions`, constante `CAL_LINK`.
- **Symboles privatisés** (22) : exports devenus `const`/`function`/`type` internes dans
  `src/lib/utils.ts`, `src/hooks/use-chat.ts`, `src/components/chat/constants.ts`,
  `src/lib/supabase/admin.ts`, `src/lib/ai/skills/executor.ts`,
  `src/lib/ai/security/prompt-injection.ts`, `src/lib/admin/errors.ts`,
  `src/lib/admin/schemas.ts`, `src/features/admin/queries.ts`,
  `src/features/admin/leads-queries.ts`, `src/lib/constants.ts`,
  `src/lib/ai/contracts/domain.ts`.
- **Types supprimés** (4 + `MemoryTypeFilterSchema`) : types morts sans usage interne.

**Déviation assumée** : `MemoryTypeFilterSchema` supprimé entièrement (et non simplement
privatisé) — après privatisation, il devenait un warning ESLint nouveau, ce qui violait la
contrainte « aucun warning nouveau ».

**Validation (avant commit)** : Prettier clean (12 fichiers) ; ESLint ciblé = 0 erreur +
2 warnings préexistants (`executor.ts`, confirmés via `git stash`) ; `npm run lint` = 0 erreur
/ 77 warnings (identique baseline) ; `npm run typecheck` = 0 erreur ; `npm run test` = 62
fichiers / 692 tests passés + 1 todo (identique baseline) ; `npm run build` vert (warning
`INEFFECTIVE_DYNAMIC_IMPORT` préexistant).

**Cross-check bundles (signature « pure cleanup »)**

- CSS : SHA256 strictement identique entre la baseline `0993f61` et V1 (`styles-BaCpWVTQ.css`,
  126 713 octets) ; fichier servi en production octet-à-octet égal au build local V1.
- JS : hash changé ; ancien fichier baseline en 404 (remplacé par le deploy).
- Taille : total client −1 octet ; `vendor-zod` −15 o, `constants` −15 o, `badge` −49 o.
  La faiblesse de la réduction est attendue : les mots-clés `export` et les types sont
  effacés par la minification ; la valeur de V1 est l'hygiène source, pas le bundle.

**Limite admin (documentée)** : aucune vérification des routes `/admin/*` en production —
pas de session réelle disponible. Conforme à la pratique des lots précédents (items #1, #12).

**Non réalisé (hors périmètre V1)** : vagues V2–V6 (fichiers morts, barrels, exports
AI/observability, CSS `canvas-gpu`, dépendances) ; 8 décisions produit en attente.

- **Suite** : Vague IA/observabilité migrée dans l'item #20 (V4-a, V4-b1, V4-b2, V4-c).

---

## 16 — Purge clé i18n `floating.cta` (FR + EN)

- **Priorité** : `P3`
- **Lot cible** : `6.4-b V2`
- **Statut** : `résolu en production` — commit `a1e5c1d` (V2-b) sur `origin/main` le
  `2026-10-15`, CI/E2E/Integration ✅. **Preuve production** : aucune clé i18n brute
  détectée sur `/`, `/about`, `/journal` (FR/EN).
- **Date** : `2026-10-15`

**Contexte**

La suppression de `FloatingCTA` (item **#9**, V2-a) a rendu la clé `floating.cta` morte :
elle n'était consommée que par `src/components/site/floating-cta.tsx:30`
(`{t("floating.cta")}`). Aucun autre consommateur dans `src/`, `e2e/`, `scripts/` ou `docs/`
(grep vérifié avant purge).

**Correction appliquée (LOT 6.4-b V2-b, commit `a1e5c1d`, 2026-10-15)**

Suppression des 2 entrées dans `src/lib/locale-context.tsx` :

- bloc `en` : `"floating.cta": "Let's talk"` (ex-l.79)
- bloc `fr` : `"floating.cta": "Discutons"` (ex-l.600)

Parité FR/EN stricte maintenue (test `locale-context.test.ts` vert après purge).

---

## 17 — `use-mobile.tsx` — supprimé (V6-a, orphelin après `sidebar.tsx`)

- **Priorité** : `P3`
- **Lot cible** : `V6-a` (décision shadcn tranchée : purge partielle)
- **Statut** : `supprimé` — décision produit « shadcn keep/purge » rendue le 2026-10-19 :
  purge partielle validée (19 composants conservés). `src/components/ui/sidebar.tsx` supprimé
  dans V6-a → `use-mobile.tsx` devenu entièrement orphelin (0 import applicatif, barrel mis à
  jour) → fichier supprimé. Re-export associé retiré de `src/hooks/index.ts`.
  Hook vivant distinct `useIsMobileViewport` (`src/lib/use-is-mobile-viewport.ts`) inchangé
  (consommé par 10+ fichiers applicatifs).
- **Date** : `2026-10-19`

**Preuve V2-pre (read-only)**

| Signal                      | Constat                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Import applicatif direct    | 0 (hors `sidebar.tsx`)                                                                                   |
| Barrel `src/hooks/index.ts` | re-export `useIsMobile` — barrel `@/hooks` jamais importé                                                |
| `sidebar.tsx`               | importe `useIsMobile`, mais n'est lui-même importé nulle part                                            |
| Runtime 390px               | responsive piloté par `useIsMobileViewport` (`src/lib/use-is-mobile-viewport.ts`), pas par `useIsMobile` |
| Framework entry points      | absent                                                                                                   |

Hook vivant distinct : `useIsMobileViewport` (consommé par 10 fichiers applicatifs).

---

## 18 — LOT 6.4-b V3 — barrels morts supprimés + exports `skills` purgés

- **Priorité** : `P3`
- **Lot cible** : `6.4-b V3`
- **Statut** : `corrigé localement, non commité, non déployé` — suppressions et purge
  appliquées en local dans le cadre du GO LOT 6.4-b V3. **Non poussé, non déployé.**
- **Date** : `2026-10-15`

**Contexte**

L'audit Knip LOT 6.4-a a identifié plusieurs barrels `index.ts` sans consommateur et
6 exports morts dans `src/lib/ai/skills/index.ts`. La décision shadcn restant en attente,
les barrels liés à shadcn (`src/hooks/index.ts`) et à l'organisation du code
(`src/types/index.ts`, `src/types/admin.ts`) sont conservés.

**Barrels supprimés (7)**

| Barrel                             | Raison                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `src/components/chat/index.ts`     | 0 import applicatif (consommateurs via `@/components/chat/ChatWidget` profond)        |
| `src/lib/ai/index.ts`              | 0 import applicatif (consommateurs via chemins profonds `@/lib/ai/*`)                 |
| `src/lib/auth/index.ts`            | 0 import applicatif (consommateurs via `@/lib/auth/session`, `@/lib/auth/middleware`) |
| `src/lib/ai/agent/index.ts`        | 0 import applicatif (consommateurs via `@/lib/ai/agent/orchestrator`)                 |
| `src/lib/ai/conversation/index.ts` | 0 import applicatif (consommateurs via `@/lib/ai/conversation/conversation-service`)  |
| `src/lib/ai/memory/index.ts`       | 0 import applicatif                                                                   |
| `src/lib/ai/security/index.ts`     | 0 import applicatif (consommateurs via `@/lib/ai/security/rate-limiter`)              |

**Barrels conservés (explicite)**

- `src/hooks/index.ts` — lié à la décision shadcn (re-export `useIsMobile` consommé par
  `sidebar.tsx`, shadcn conservé).
- `src/types/index.ts`, `src/types/admin.ts` — organisation du code, hors périmètre V3.
- `src/lib/ai/skills/index.ts` — contient des exports vivants (voir purge ci-dessous).

**Purge exports `skills/index.ts`**

Exports morts retirés (0 consommateur via barrel, uniquement imports profonds ou mock
objects) : `registerSkill`, `unregisterSkill`, `getSkill`, `listSkills`, `hasSkill`,
`getSkillsByPermission`.

Exports vivants **conservés impérativement** (importés via le barrel `../skills` /
`@/lib/ai/skills`) : `initializeSkills` (`src/server/functions/chat.ts:14`),
`skillRegistry` + `getAllToolDefinitions` + `skillExecutor`
(`src/lib/ai/agent/orchestrator.ts:3-4`).

**Décision shadcn** : **validée le 2026-10-19 (V6-a) — purge partielle**. 31 composants UI
mort supprimés (dont `sidebar.tsx`) + `use-mobile.tsx` orphelin ; 19 composants conservés.
Vague **V6-b** exécutée le `2026-10-19` (`a2cbfef`) : 19 dépendances Radix mortes + 8 libs
associées désinstallées (`dependencies` 59 → 32, 7 Radix conservés). **Décision officiellement
clôturée (V6-a + V6-b poussés le 2026-10-19).**

**Limite** : committé en local (`a380786`), non poussé, non déployé — en attente du GO de push V3.

---

## 19 — Hero canvas mobile — réactivation avec params allégés + kill-switch

- **Priorité** : `P2`
- **Lot cible** : `6.4-b V3+`
- **Statut** : `résolu en production` (validation complète) — réactivation poussée avec le
  commit Hero `908b99c`, assertion E2E alignée avec le commit `e836983`, **validée sur iPhone
  réel par l'utilisateur le `2026-10-18`**.
- **Date** : `2026-10-15` (ouverture) → `2026-10-18` (résolution)

**Contexte**

Les 2 canvas du hero (`MatrixRain` en thème dark, `ParticleField` en thème light) avaient
été démontés sur mobile (LOT 42 P2) car ils saturaient le main thread iOS (taps + paint
bloqués). Un fallback CSS animé (`.matrix-css-fallback`, GPU pur) était servi à la place.
Ce lot réactive les canvas sur mobile avec des params allégés, tout en gardant un
kill-switch de rollback.

**Changements**

- `hero.tsx` : retrait du gating `!isMobile` + des classes `hidden md:block` sur les
  wrappers canvas. Canvas affiché sur desktop **et** mobile. Le fallback reste rendu
  (SSR) mais est masqué (classe `hidden`) quand le canvas est actif ; il n'est
  réaffiché que si le kill-switch est désactivé sur mobile (repli LOT 42/44).
- `matrix-code.tsx` : props `frameMs` (défaut 66) + `mobile`. DPR cap 3 paliers.
- `particle-field.tsx` : props `frameMs` (défaut 66) + `shadowBlur` (défaut 4) + `mobile`.
  DPR cap 3 paliers. `shadowBlur` forcé à 0 sur mobile (flou d'ombre très coûteux sur iOS).

**DPR cap 3 paliers (Option B — aucun régression desktop)**

`dprCap = mobile ? 1.0 : viewportWidth < 1024 ? 1.5 : 2`

| Palier   | Viewport      | DPR   | Rationale                                  |
| -------- | ------------- | ----- | ------------------------------------------ |
| Mobile   | `< 768 px`    | `1.0` | iOS Retina — économie GPU                  |
| Tablette | `768–1023 px` | `1.5` | inchangé (valeur LOT 41)                   |
| Desktop  | `≥ 1024 px`   | `2.0` | DPR d'origine préservé (aucune régression) |

**Params mobile allégés** (via `hero.tsx`) : `fontSize` 22→16, `speed` 0.9→0.6 (MatrixRain) ;
`particleCount` 9→5, `shadowBlur` 4→0, `interactive={false}` (ParticleField) ;
`frameMs` 66 (mobile et desktop).

**Kill-switch** : `const MOBILE_CANVAS_ENABLED = import.meta.env.VITE_ENABLE_MOBILE_CANVAS !== "false";`
dans `hero.tsx`, utilisé comme `(!isMobile || MOBILE_CANVAS_ENABLED)`. Rollback possible via
variable d'environnement Netlify (`VITE_ENABLE_MOBILE_CANVAS=false`) **sans redéploiement de
code**. Défaut : actif.

**Tests** : `hero.test.tsx` (mobile/desktop → 1 canvas, fallback masqué) ;
`matrix-code.test.tsx` + `particle-field.test.tsx` (DPR 3 paliers, frameMs, shadowBlur).

**Résolution en production (GO #2 + clôture documentaire, 2026-10-18)**

Commits : `908b99c` (Hero — réactivation) + `e836983` (E2E — assertion alignée).

Preuves :

- CI / E2E / Integration **success** sur `e836983` (runs 39076465367 / 39076465376 /
  39076465378 ; E2E 231 s).
- **40 tests E2E verts** (4 skippés), dont le test mobile `LOT 6.4-b` mis à jour
  (1 canvas visible, fallback masqué, contenu < 3 s, CTA < 300 ms) et le test desktop
  `LOT 42` inchangé.
- Vérification prod Playwright : canvas présent (`count 1`, visible, non `hidden`),
  **DPR 1.0 mobile** (390/390), **DPR 2.0 desktop** (2880/1440 sous `deviceScaleFactor` 3),
  fallback `.matrix-css-fallback` en `hidden` + `display: none`, 0 clé i18n brute sur
  5 pages, hash CSS inchangé / hash JS changé.
- **Validation iOS réelle par l'utilisateur le `2026-10-18`** : fluide, **pas de saturation**
  du main thread.

Limites documentées :

- LOT 42 P2 / LOT 44 P0 (désactivation du canvas mobile) sont **officiellement inversés** et
  remplacés par l'approche « params allégés » (DPR 1.0, `frameMs` 66, `shadowBlur` 0).
- Le **kill-switch `VITE_ENABLE_MOBILE_CANVAS`** reste disponible en cas de régression future
  (ex. nouvelle version d'iOS) : `false` dans Netlify UI + redeploy (~2 min). Compilé à la
  build, donc **non simulable en E2E** — aucune couverture de test automatisé pour ce chemin.

---

## 20 — LOT 6.4-b V4 — IA + observabilité (exports morts AI)

- **Priorité** : `P2`
- **Lot cible** : `6.4-b` (V4 — exports morts IA / observability)
- **Statut** : `terminé, poussé` — V4-a (`3f38d75`), V4-b1 (`3218958`), V4-b2a (`909530b`),
  V4-b2b (`be9c52e`), V4-c (`e694b8c`) poussés sur `main`.
- **Date** : `2026-10-18`

**Contexte**

La vague « exports AI/observability » différée par l'item #15 (l.745, l.786) est traitée ici,
via deux sous-ensembles : V4-a (module `observability`) et V4-b1 (19 symboles morts totaux de
la couche IA + purge du star-export `skills/index.ts`). Cet item sert d'ombrelle pour les
vagues V4 restantes (V4-b2, V4-c).

**V4-a — réduction `observability.ts` — corrigé, poussé (`3f38d75`)**

- `src/lib/observability.ts` réduit 319 → 152 lignes (−167, −52 %).
- Supprimés : `StructuredLogger`, `logger`, `MetricData`, `LogEntry`, 10 `record*`.
- Privatisés : `HealthChecker` (classe), `HealthCheckResult` (type), `healthChecker` (instance).
- Conservé : `EventEmitter`, `MetricsCollector`, `metrics` (seul export restant).
- Retiré : import `healthChecker` mort dans `src/server/functions/health.ts:4`
  (`import { metrics } from "@/lib/observability"` conservé).
- Note : vérif FR seulement justifiée (fichiers server-only, aucun impact bundle client —
  hash JS client inchangé après push).

**V4-b1 — 19 symboles morts + purge star-export — corrigé, poussé (`3218958`)**

- 19 symboles morts totaux supprimés (7 fonctions/constantes + 11 schemas/constantes + 1 type).
- `checkContextSize` supprimé entièrement (branche `entire` : 0 appel interne, 0 importeur —
  copie privée distincte dans `orchestrator.ts`, hors périmètre V4-b1).
- Purge du star-export `export * from "./registry"` dans `src/lib/ai/skills/index.ts`.
- Conserve (exports nommés) : `initializeSkills`, `skillRegistry`, `getAllToolDefinitions`.
- Conserve (vivants/garde-fous) : `ChatMessageSchema`, `ChatHistorySchema`,
  `MAX_CONVERSATION_HISTORY`, `sanitizeInput`, `validateAndSanitize`, `isValidationError`,
  `ValidationError`.
- Gates locaux : prettier OK, lint 0 err / 76 warn, typecheck OK, 692 tests + 1 todo,
  build OK, `git diff --check` OK. Diff : 11 fichiers, +2 / −163.

**V4-b2a — Nettoyage imports + bonus**

- **Statut** : corrigé, poussé (`909530b`)
- 27 imports morts retirés (12 fichiers)
- 5 fns/vars mortes supprimées
- `MAX_CONVERSATION_HISTORY` privatisé, 3 fonctions registry supprimées
- Lint : 76 → 45 warnings

**V4-b2b — Privatisations massives**

- **Statut** : corrigé, poussé (`be9c52e`)
- 72 symboles privatisés sur 23 fichiers
- 0 code supprimé, `domain.ts` intact, 0 import externe cassé

**V4-c — Déplacement TEST_ONLY**

- **Statut** : corrigé, poussé (`e694b8c`)
- 5 symboles test-only déplacés dans les tests (`SearchKnowledgeInputSchema`,
  `SummarizeInputSchema`, `createSkillSchema`, `hasSkill`, `unregisterSkill`)
- 39 CONSERVER intacts

**Dette technique identifiée (hors périmètre V4)**

- 39 symboles TEST_ONLY conservés (dont sécurité/RAG) : câblage à revoir
- Doublons identifiés : `applySecurityHeaders` / `addSecurityHeaders`, CSP, middlewares admin
- `getAIConfig` vs env direct dans `chat.ts`

**Notes transversales**

- Décision shadcn **validée (V6-a, 2026-10-19)** : purge partielle — `hooks/index.ts`
  mis à jour (re-export `useIsMobile` retiré) ; `types/index.ts`, `types/admin.ts` conservés.
- `skills/index.ts` conservé (`initializeSkills` + `skillRegistry` vivants).
- Vérif Playwright FR+EN obligatoire avant push V4-b1 (code client potentiellement impacté
  via `chat.ts`).

**V5 — CSS canvas-gpu**

- **Statut** : corrigé, poussé (`2bafd45`)
- Suppression de `@utility canvas-gpu` (`src/styles.css`, −10 lignes)
- 0 usage code confirmé (grep) ; faux positif prose BACKLOG documenté
- Note : gate Prettier waivé sur `styles.css` (dérive préexistante `--shadow-*`, hors périmètre)

**Clôture LOT 6.4-b**

- **V3** (barrels morts) : poussé
- **V4** (IA + observabilité) : poussé (V4-a, V4-b1, V4-b2a, V4-b2b, V4-c)
- **V5** (CSS canvas-gpu) : poussé (`2bafd45`)
- **V6-a** (fichiers UI morts) : poussé (`ccb62f3`) — purge 31 fichiers + `use-mobile.tsx`
- **V6-b** (dépendances Radix/lib mortes) : poussé (`a2cbfef`) — 19 Radix + 8 libs désinstallés
- **Backlog large** : items i18n parallèles, backdrop-blur, docs obsolètes, `bun.lock`
  restent ouverts.

---

## 21 — Design/UX-1 — navbar admin isolée, bouton retour ≥44 px, libellé retour i18n

- **Priorité** : `P3`
- **Lot cible** : `Design/UX-1`
- **Statut** : `corrigé localement, non commité, non déployé` — corrections appliquées dans
  le cadre du GO « DESIGN/UX-1 » (2026-10-19), enchaîné à l'audit Design/UX read-only.
  **Non commité, non poussé, non déployé** (en attente du GO de commit).
- **Date** : `2026-10-19`

**Changements (9 fichiers)**

| Fichier                                                             | Changement                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/admin/admin-header.tsx`                             | nav `gap-3` ; groupes admin isolés dans une pill `rounded-full border-brand/25 bg-brand/[0.07] p-0.5 gap-0.5` (liens `px-2.5`) ; ancien filet vertical retiré ; zone droite `gap-1.5` ; avatar `size-9` ; séparateur `h-6 w-px` avant le menu utilisateur |
| `src/components/admin/admin-page-header.tsx`                        | nouvelle prop `backLabel?: string` (défaut : `t("admin.common.back")`)                                                                                                                                                                                    |
| `src/components/admin/back-button.tsx`                              | `min-h-[44px]` ajouté (cible tactile mobile ≥ 44 px, hauteur inchangée visuellement)                                                                                                                                                                      |
| `src/lib/locale-context.tsx`                                        | clé `admin.common.backToDashboard` ajoutée FR (`Retour au tableau de bord`) + EN (`Back to dashboard`) — parité FR/EN vérifiée par `locale-context.test.ts`                                                                                               |
| `src/routes/admin/{articles,realisations,leads,messages,ai-memory}` | `backTo="/admin"` + `backLabel={t("admin.common.backToDashboard")}` sur les 5 AdminPageHeader                                                                                                                                                             |

**Contrôles (avant → après)**

- Prettier / ESLint / typecheck : **0 erreur** (lint 22 warnings préexistants inchangés, dont
  2 `leads.tsx` ; baseline avant édition identique).
- Tests : **696 passed + 1 todo** (62 files) — identique avant/après.
- Build : 1.90 s, 0 erreur.
- `git diff --check` : 0.

**Vérification visuelle locale (preview `:4173` + Playwright, navigation SPA, session fausse)**

- **249 checks / 0 fail** — FR + EN × 6 pages : pill isolée (classes + gap 2 px + padding
  10 px), nav `gap-3`, ancien filet absent (count 0), zone droite `gap-1.5`, séparateur
  `h-6` avant avatar (ordre DOM/position vérifié), avatar 36×36 avec `aria-label`, 0 clé
  i18n brute, 0 débordement horizontal, bouton retour visible + libellé localisé
  (`Retour au tableau de bord` / `Back to dashboard`) + 44 px + focus visible + navigation
  clavier + clic → `/admin`, `/admin` sans bouton retour.
- Mobile 390×844 : burger visible, drawer intacte, retour 44 px, 0 débordement.
- h1 des 5 listes attendu en FR + EN (swap SPA mesuré ~70 ms après l'URL — les lectures
  instantanées montraient l'h1 de la page précédente, artefact de test, pas un défaut).

**Limite** : vérification locale uniquement — aucune session admin réelle en production.

---

## Note complémentaire — clés manquantes supplémentaires

Conformément à la consigne d'ajout, l'audit 5.2-pre-a a recherché toute clé i18n manquante
découverte hors couverture de l'item global **#1**.

**Résultat : aucun item supplémentaire requis.**

- `about.process.subtitle` (liste a) → déjà couverte par l'item **#3**.
- `admin.common.prev`, `admin.common.next` (liste c) → déjà couvertes par l'item global **#1**.
- Liste (b) → vide.
- Les **45 clés candidates au nettoyage** (à revérifier au lot dédié, sur la base des mêmes
  contrôles) et les 3 sources de traduction parallèles identifiées par l'audit relèvent du
  rapport 5.2-pre-a (sections 7 et 8) et n'ouvrent pas de clé manquante.

---

## Historique

- `2026-10-14` — push `4f481dc`, vérification production `/about` EN OK.
- `2026-10-15` — push `21a28ac` (LOT 5.2), vérification prod SSR 8/8 pages OK.
- `2026-10-15` — push `e433832` (LOT 6.1), purge 47 dead keys, CI/E2E/Integration ✅, vérif prod FR/EN OK (admin non vérifié, sans session).
- `2026-10-15` — LOT 6.3 préparé localement (non commité, non déployé) : titres `/contact` en `h2`, `id="process"` + ancre footer `/about#process`, `LocaleSwitcher` `aria-label` i18n via `role=group`, finding `/services` infirmé (faux positif) + verrouillé par test. Items **#7**, **#8**, **#14** → `corrigé localement, non commité, non déployé` ; item **#13** → `faux positif — non applicable` (hiérarchie DOM réelle déjà `h1 → h2 → h3`, test de non-régression ajouté).
- `2026-10-15` — push `988131b` (LOT 6.3), CI/E2E/Integration ✅. Vérifications production : `/contact` → hiérarchie servie `h1 → h2 → h2` puis `h3` footer (1 h1, 2 h2, 3 h3) ; `/about` → `id="process"` présent, footer pointant vers `/about#process`, ancien href `/about#realisations` absent. Items **#7**, **#8**, **#14** → `résolu en production` ; item **#13** confirmé `faux positif — non applicable`. Limite : libellé FR/EN du `LocaleSwitcher` non revérifié en production (SSR FR par défaut), bascule validée sur preview locale.
- `2026-10-15` — push `8903194` (LOT 6.4-b V1), CI/E2E/Integration ✅ (runs 38792476886 / 38792477055 / 38792476935). Vérification production : 12/12 pages FR/EN OK (6 pages × 2 locales), CSS strictement inchangé, hash JS changé, aucune clé i18n brute. Item **#15** → `résolu en production`. Limites : routes `/admin/*` non vérifiées en production (pas de session réelle) ; réduction de bundle marginale (−1 octet client) — valeur principale = hygiène source.
- `2026-10-15` — LOT 6.4-b V2-pre (read-only, `c600594`) : revalidation des 5 candidats V2. Verdicts : FloatingCTA `non utilisé` (0 import, absent DOM prod 12/12) ; `data/articles.ts` `non utilisé` (0 import, journal Supabase) ; `data/projects.ts` `non utilisé` (type-only effacé, `/work` Supabase) ; export `ProjectCard` `non utilisé` (0 import externe) ; `DbRealisationCard`/`CTAStrip` `montés` (3 + 7 routes) ; `use-mobile.tsx` `à investiguer` (importé par `sidebar.tsx` shadcn non monté, bloqué sur décision keep/purge). Aucune modification (read-only strict).
- `2026-10-15` — LOT 6.4-b V2 préparé localement (non commité, non déployé) : suppression `floating-cta.tsx` + test, `data/articles.ts`, `data/projects.ts` ; retrait export `ProjectCard` + `import type { Project }` de `project-card.tsx` (`DbRealisationCard`/`CTAStrip` intacts) ; purge i18n `floating.cta` FR/EN. Items **#6**, **#9**, **#16** → `corrigé localement, non commité, non déployé` ; item **#17** (`use-mobile.tsx`) → `à investiguer` (bloqué décision shadcn). Garde-fous greps post-modif : 0 référence résiduelle. Tests/typecheck/build locaux à confirmer avant commit.
- `2026-10-15` — push `d2418d9` + `a1e5c1d` (LOT 6.4-b V2-a + V2-b), CI/E2E/Integration ✅ (runs 38804280520 / 38804280607 / 38804280967). Vérification production : 3 pages (`/`, `/about`, `/journal`) → HTTP 200, `DbRealisationCard` (liens `/work/`) et `CTAStrip` (`py-24`) présents, filtres journal intacts, 0 clé i18n brute. Déviation CSS attendue : hash modifié (`styles-BaCpWVTQ.css` → `styles-DZvJAZxe.css`) par rescan Tailwind après suppression de `floating-cta.tsx` — classes critiques des composants restants vérifiées présentes (`rounded-card`, `aspect-[4/3]`, `object-cover`, `py-24`, `md:py-32`, `group-hover:rotate-45`, `line-clamp`). Items **#6**, **#9**, **#16** → `résolu en production` ; item **#17** maintenu `à investiguer` (bloqué décision shadcn keep/purge).
- `2026-10-15` — LOT 6.4-b V3 préparé localement (non commité, non déployé) : suppression de 7 barrels morts (`components/chat`, `lib/ai`, `lib/auth`, `lib/ai/agent`, `lib/ai/conversation`, `lib/ai/memory`, `lib/ai/security`) + purge de 6 exports morts de `ai/skills/index.ts` (`registerSkill`, `unregisterSkill`, `getSkill`, `listSkills`, `hasSkill`, `getSkillsByPermission`); conservés : `initializeSkills`, `skillRegistry`, `getAllToolDefinitions`, `skillExecutor` (vivants via barrel). Barrels conservés : `hooks/index.ts`, `types/index.ts`, `types/admin.ts`, `skills/index.ts` + shadcn. Item **#18** → `corrigé localement, non commité, non déployé`.
- `2026-10-15` — commit local `a380786` (LOT 6.4-b V3) : 7 barrels supprimés + purge exports `skills/index.ts` + backlog. Non poussé, non déployé.
- `2026-10-15` — LOT 6.4-b V3+ Hero canvas mobile préparé localement (non commité, non déployé) : réactivation des 2 canvas du hero sur mobile (`MatrixRain` dark + `ParticleField` light) avec params allégés — DPR cap 3 paliers (mobile 1.0 / tablette 1.5 / desktop 2.0, aucun régression desktop), `frameMs` 66, `shadowBlur` 0 mobile, `fontSize` 16 / `particleCount` 5 / `interactive=false` mobile. Kill-switch `VITE_ENABLE_MOBILE_CANVAS` (rollback sans redéploiement). Fallback `.matrix-css-fallback` masqué quand canvas actif. Tests : DPR 3 paliers, frameMs, shadowBlur, 1 canvas + fallback masqué (desktop et mobile). Item **#19** → `corrigé localement, non commité, non déployé`. **Limite : mesure iOS réelle sur iPhone non réalisée dans ce lot — requise avant validation définitive.**
- `2026-10-15` — push `a380786` (LOT 6.4-b V3), CI/E2E/Integration ✅. Item **#18** → `résolu en production`.
- `2026-10-18` — push `908b99c` (Hero canvas mobile) + `e836983` (E2E assertion alignée), CI/E2E/Integration ✅ (runs 39076465367 / 39076465376 / 39076465378). Vérification production : canvas mobile actif (1 canvas visible, fallback masqué), DPR 1.0 mobile / 2.0 desktop, 0 clé i18n brute sur 5 pages, hash CSS inchangé / hash JS changé. E2E 40 tests verts dont le test mobile `LOT 6.4-b` mis à jour. **Validation iOS réelle par l'utilisateur le 2026-10-18 : fluide, pas de saturation.** Item **#19** → `résolu en production`. LOT 42 P2 / LOT 44 P0 officiellement inversés (remplacés par les params allégés) ; kill-switch `VITE_ENABLE_MOBILE_CANVAS` maintenu pour régression future.
- `2026-10-19` — **V6-a** préparé localement (non poussé) : décision shadcn tranchée (**purge partielle, 19 composants conservés**). Suppression de 31 composants UI morts de `src/components/ui/` (27 à 0 import + 4 transitivement morts : `separator`, `skeleton`, `tooltip`, `toggle` via `sidebar`/`toggle-group`), suppression orpheline `src/hooks/use-mobile.tsx` + re-export retiré de `src/hooks/index.ts` (barrel conservé pour `useChat`/`useStickyScroll`). Garde-fous greps pré/post (src, e2e, scripts, docs) : **0 import applicatif, 0 test** impacté ; résidu connu : commentaire JSDoc `chat/constants.ts:8` mentionnant `useIsMobile` (fichier vivant hors périmètre V6-a). `useIsMobileViewport` (`src/lib/`) vivant et inchangé. **Aucune modification de `package.json`** — dépendances (19 Radix + 8 libs) reportées à **V6-b**. Item **#17** → `supprimé`.
- `2026-10-19` — **V6-b** (`a2cbfef`) : désinstallation des 27 dépendances mortes (19 `@radix-ui/*` + `recharts`, `react-day-picker`, `react-resizable-panels`, `vaul`, `cmdk`, `input-otp`, `embla-carousel-react`, `date-fns`) — `dependencies` **59 → 32**, 7 Radix conservés, résidus `package.json`/`npm ls` = 0, JSDoc `useIsMobile` corrigé (`chat/constants.ts`, seule source touchée). Gates : prettier/lint **0 err / 22 warn**, typecheck, **696 + 1 todo (697)**, build 1.86 s, `npm audit` 23 total / **0 critical** (inchangé — paquets supprimés sans advisory ; gain `node_modules`/lockfile/surface).
- `2026-10-19` — **Push global V6** (`14b38cf..a2cbfef` = V6-a `ccb62f3` + V6-b `a2cbfef`) : CI/E2E/Integration ✅ (runs 39320735604 / 39320735451 / 39320735587). Production : `/` HTTP 200, `/api/health` **200 healthy `version=a2cbfef`**. Smoke global Playwright FR **9/9** (home 200 + h1 + 0 clé i18n brute, ChatWidget ouvert, `/services` + `/cgu` 200, `/admin` → `/auth/login?redirect=…` 200 avec formulaire de login visible). Doc de stack mise à jour (README tests 696 + 1 todo, WEBI_ARCHITECTURE Radix 7 primitives / 19 composants / 696 tests, hash `a2cbfef`). **Décision shadcn officiellement clôturée.**
- `2026-10-19` — **Doc stack** (`0ae87b7`) poussée : CI/E2E/Integration ✅ (runs 39322487785 / 39322487699 / 39322487806). Aucune modification applicative.
- `2026-10-19` — **Design/UX-1** préparé localement (non commité, non déployé) : navbar admin regroupée en pill isolée (`border-brand/25` `bg-brand/[0.07]`), nav `gap-3`, filet vertical retiré, zone droite `gap-1.5` + séparateur `h-6 w-px` + avatar `size-9` ; `AdminPageHeader` prop `backLabel` + `BackButton min-h-[44px]` ; clé i18n `admin.common.backToDashboard` FR/EN ajoutée et branchée sur les 5 listes admin (`backTo="/admin"`). Gates : prettier/lint **0 err / 22 warn** (baseline identique), typecheck, **696 + 1 todo**, build 1.90 s, `git diff --check` 0. Vérification visuelle locale (preview `:4173` + Playwright, navigation SPA avec session fausse) : **249 checks / 0 fail** (FR + EN × 6 pages + mobile 390×844), h1 des 5 listes attendu en 2 locales (swap SPA ~70 ms — lectures instantanées décalées = artefact de test). Limite : **local uniquement, aucune vérification en production** (pas de session admin réelle). Item **#21** → `corrigé localement, non commité, non déployé`.
