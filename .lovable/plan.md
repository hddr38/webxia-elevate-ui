# Plan : contenu des onglets de la navbar

## Architecture de routing

Passage d'une SPA single-page (ancres `#services`, `#work`...) à un site multi-pages avec routes dédiées. Chaque onglet aura sa propre URL, son propre `head()` SEO, et sera partageable.

```text
src/routes/
  __root.tsx
  index.tsx        → /          (Home : Hero + aperçu services + CTA contact)
  services.tsx     → /services  (existant, à extraire de la home)
  work.tsx         → /work      (NOUVEAU — grille de projets)
  about.tsx        → /about     (NOUVEAU — studio, équipe, valeurs, stack)
  journal.tsx      → /journal   (NOUVEAU — liste d'articles)
  journal.$slug.tsx → /journal/:slug (NOUVEAU — article individuel)
  contact.tsx      → /contact   (à extraire de la home)
```

## Contenu de chaque onglet

### 1. `/` — Home (allégée)

- Hero (existant)
- Aperçu condensé des Services (3-4 cartes) + lien « Voir tous les services »
- Section « Selected work » : 3 projets phares + lien « Voir tous les projets »
- Bandeau CTA final vers `/contact`

### 2. `/services` — Services

- Hero de section : eyebrow + titre + sous-titre (existant)
- Grille des **4 ServiceCards** (Design & Brand, Dev Web & App, Intégration IA, Croissance & SEO) — existant
- Pour chaque service : section détaillée avec process / livrables / techno
- CTA final vers `/contact`

### 3. `/work` — Réalisations (NOUVEAU)

- Hero : « Selected work » + sous-titre
- **Grille de projets avec images** (filtrable par catégorie : Web / App / IA / Brand)
- Chaque carte projet : image cover, nom client, type de projet, année, tags techno, effet hover (zoom léger + overlay)
- 6-9 projets fictifs au départ (placeholders cohérents avec l'aesthetic premium)
- CTA contact en bas

### 4. `/about` — Studio (NOUVEAU)

Page complète avec plusieurs sections :

- **Manifeste** : pourquoi WebXIA existe, vision
- **L'équipe** : présentation des membres (photos + rôle + bio courte)
- **Valeurs** : 3-4 piliers (craft, vitesse, transparence, impact)
- **Stack technique** : technos utilisées (React, TanStack, Tailwind, IA, edge…)
- **Process** : méthodologie en 4 étapes (Discovery → Design → Build → Launch)
- **Localisation** : Paris / Remote
- CTA contact

### 5. `/journal` — Blog (NOUVEAU)

- Hero : « Journal » + sous-titre « Articles, études de cas, actualités »
- **Filtres par catégorie** : Tous / Articles / Études de cas / Actualités
- Grille d'articles : image cover, catégorie (badge), titre, extrait, date, temps de lecture, auteur
- 6 articles seed (mix des 3 catégories)

### 6. `/journal/$slug` — Article individuel (NOUVEAU)

- Header article : catégorie, titre, auteur, date, temps de lecture, image cover
- Corps de l'article (markdown/MDX rendu, ou JSX simple)
- Section « Articles liés » en bas
- CTA contact

### 7. `/contact` — Contact

- Existant (formulaire + placeholder Calendly + badges de confiance)

## Modifications techniques

### Header (`src/components/site/header.tsx`)

- Remplacer les `<a href="#...">` par des `<Link to="/services">`, `<Link to="/work">`, etc. de `@tanstack/react-router`
- Ajouter `activeProps={{ className: "text-foreground bg-secondary" }}` pour l'état actif
- Le CTA « Book a call » pointe vers `/contact`

### Locale dictionary (`src/lib/locale-context.tsx`)

Ajouter les clés de traduction pour les nouvelles pages :

- `work.title`, `work.subtitle`, `work.filter.*`
- `about.manifesto.*`, `about.team.*`, `about.values.*`, `about.process.*`
- `journal.title`, `journal.subtitle`, `journal.filter.*`
- Métadonnées SEO pour chaque page (titre + description en EN/FR)

### SEO par route

Chaque nouvelle route définit son propre `head()` avec :

- `title` spécifique
- `description` spécifique
- `og:title`, `og:description`
- `og:image` au niveau de chaque page (sur `/journal/$slug`, dérivé du loader data)
- `link rel=canonical`

### Données seed

- `src/data/projects.ts` : 6-9 projets pour `/work` (titre, slug, cover, catégorie, tags, année, client)
- `src/data/team.ts` : 3-4 membres pour `/about`
- `src/data/articles.ts` : 6 articles pour `/journal` (titre, slug, catégorie, extrait, contenu, date, auteur, cover)

### Assets

Génération d'images covers premium (abstrait tech, dégradés sobres) pour les projets et articles via `imagegen` — pas de photos stock génériques.

### FloatingCTA

Le FloatingCTA pointe vers `/contact` (et reste masqué sur la page `/contact`).

## Hors scope (pour une itération ultérieure)

- CMS headless pour le blog (les articles seront en TS dans `src/data/articles.ts`)
- Pages de cas client détaillées `/work/$slug` (peut être ajouté ensuite)
- Système de tags clickables sur le blog
- Recherche dans le journal
