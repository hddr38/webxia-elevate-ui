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

| #   | Priorité | Titre                                                                            | Lot cible       | Statut               | Date       |
| --- | -------- | -------------------------------------------------------------------------------- | --------------- | -------------------- | ---------- |
| 1   | P1       | Audit i18n global — clés manquantes FR/EN (issu LOT 5.2-pre-a)                   | `5.2-pre-b`     | résolu en production | 2026-10-14 |
| 2   | P1       | Filtres journal incohérents (boutons ≠ catégories réelles en base)               | `5.3`           | ouvert               | 2026-10-14 |
| 3   | P1       | `about.process.subtitle` absent en EN                                            | `5.2-pre-b`     | résolu en production | 2026-10-14 |
| 4   | P3       | FloatingCTA `animate-ping` continue hors interaction (I-19)                      | `5.2`           | résolu en production | 2026-10-15 |
| 5   | P2       | `backdrop-blur` ×28 statiques (perf à mesurer avant modification) (I-18)         | `5.2`           | ouvert               | 2026-10-14 |
| 6   | P3       | Code mort : `ProjectCard`, `src/data/projects.ts`, `src/data/articles.ts` (I-16) | à définir       | ouvert               | 2026-10-14 |
| 7   | P2       | Saut hiérarchique `h1` → `h3` sur `/contact` (I-11)                              | à définir       | ouvert               | 2026-10-14 |
| 8   | P3       | Ancrage footer `/about#realisations` versus section `process` (I-12)             | à définir       | ouvert               | 2026-10-14 |
| 9   | P3       | FloatingCTA non monté dans l'arborescence (composant obsolète)                   | à joindre à `6` | ouvert               | 2026-10-15 |
| 10  | P1       | SSR/hydratation animations — 65 éléments `opacity:0` corrigés                    | `5.2-b`         | résolu en production | 2026-10-15 |
| 11  | P3       | MotionConfig `reducedMotion="user"` — présent et verrouillé par test             | `N/A`           | résolu               | 2026-10-15 |

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
- **Lot cible** : `à définir`
- **Statut** : `ouvert`
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

**Correction recommandée (non appliquée)**

Supprimer l'export `ProjectCard`, puis `src/data/projects.ts` et `src/data/articles.ts`
après avoir vérifié qu'aucun test ni spec e2e ne les référence (grep déjà effectué sur
`src/` ; `e2e/` et `*.test.ts` à revérifier au moment de la suppression).

---

## 7 — Saut hiérarchique `h1` → `h3` sur `/contact` (I-11)

- **Priorité** : `P2`
- **Lot cible** : `à définir`
- **Statut** : `ouvert`
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

**Correction recommandée (non appliquée)**

Réécrire les deux sections de page (`Prendre rendez-vous`, `Envoyez-nous un message`) en `<h2>`,
et vérifier le point de départ du footer indépendamment.

---

## 8 — Ancrage footer `/about#realisations` versus section `process` (I-12)

- **Priorité** : `P3`
- **Lot cible** : `à définir`
- **Statut** : `ouvert`
- **Date** : `2026-10-14`

**Contexte**

Le lien footer « Notre méthode » / « Our Method » pointe vers `/about#realisations` alors que
la section cible porte l'id `realisations` mais présente le contenu **process**
(`about.process.title`, `about.process.1..4`). L'ancre fonctionne — la cible existe — mais le
nom de l'identifiant ne correspond ni au libellé du lien ni au contenu de la section. C'est un
désordre sémantique, pas un lien mort.

**Preuve — production, vérifiée le 2026-10-14**

`https://webxia-fr.netlify.app/about`

- `sectionIds = ["realisations"]` → la section cible **existe bien** (le lien n'est pas cassé).
- `footer a[href*="#"] = ["/about#realisations"]` → cible unique du footer.
- Le contenu de la section est celui du process (`How we work` / `Comment nous travaillons`).

**Correction recommandée (non appliquée)**

Renommer l'id en `process` **et** mettre à jour le href du footer en une seule modification
atomique (sinon le lien casse). Alternative : conserver l'id et renommer le libellé du lien —
décision éditoriale à trancher avant correction.

---

## 9 — FloatingCTA non monté dans l'arborescence (composant obsolète)

- **Priorité** : `P3`
- **Lot cible** : `à joindre à l'item code mort (I-16, item #6)`
- **Statut** : `ouvert`
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

**Action proposée**

Joindre `src/components/site/floating-cta.tsx` et son test à la suppression de code mort de
l'item **#6** (I-16), après confirmation éditoriale qu'aucune re-montée du CTA flottant n'est
prévue (sinon, le remonter explicitement plutôt que le supprimer).

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
