# Charte graphique WebXIA

> Charte extraite du code source du projet (Tailwind v4 + CSS-first tokens + composants UI).
> 100% basée sur les fichiers suivants : `src/styles.css`, `src/components/ui/button.tsx`, `src/components/site/header.tsx`, `src/components/site/hero.tsx`, `src/components/site/project-card.tsx`, `src/components/site/services.tsx`, `src/components/site/contact.tsx`, `src/components/site/footer.tsx`.

---

## 1. Identité visuelle

WebXIA est une agence web qui affiche une identé **premium, épurée et technique**.

- **Ambiance** : fond blanc proche du papier (`#FBFBFC`) sur desktop, fond zinc très sombre en dark mode (`#191B23`), accents électriques bleu et violet.
- **Valeurs** : précision, clarté, innovation. Le design mise sur la profondeur (ombres dynamiques, grilles, dégradés subtils) plus que sur la décoration.
- **Ton** : professionnel, confiant, moderne. Le code privilégie les formes arrondies, les ombres nettes et les effets glassmorphism pour une ambiance à la fois tech et accessible.
- **Signature visuelle** : texte dégradé `text-gradient-brand`, ombre glow bleue (`--shadow-glow`), badges `rounded-full`, cartes avec effet `hover:-translate-y-1` + `hover:shadow-[...brand]`.
- **Expérience** : douce, aérienne, dynamique. Les animations restent sobres (`float-slow`, transitions 300 ms) pour ne pas surcharger l’interface.

---

## 2. Palette de couleurs

### Light mode (thème par défaut)

| Nom fonctionnel        | HEX       | RGB             | Usage                                      |
| ---------------------- | --------- | --------------- | ------------------------------------------ |
| **Background**         | `#FCFCFD` | `252, 252, 253` | Fond de page principal                     |
| **Foreground**         | `#262629` | `38, 38, 41`    | Texte corps, icônes                        |
| **Surface**            | `#F6F6F8` | `246, 246, 248` | Sections alternées, fond subtil            |
| **Card**               | `#FFFFFF` | `255, 255, 255` | Cartes, modales, popovers                  |
| **Primary**            | `#262629` | `38, 38, 41`    | Boutons principaux sombres, éléments forts |
| **Primary Foreground** | `#FCFCFD` | `252, 252, 253` | Texte sur Primary                          |
| **Secondary**          | `#F4F4F5` | `244, 244, 245` | Boutons secondaires, badges subtils        |
| **Muted**              | `#F4F4F5` | `244, 244, 245` | Fond désactivé, arrière-plans neutres      |
| **Muted Foreground**   | `#7C7C85` | `124, 124, 133` | Texte secondaire, labels, placeholders     |
| **Brand**              | `#1D4ED8` | `29, 78, 216`   | CTA, liens actifs, accents principaux      |
| **Brand Glow**         | `#6D8DF5` | `109, 141, 245` | Ombres portées, dégradés brand             |
| **Accent**             | `#9333EA` | `147, 51, 234`  | Accent violet, badges spéciaux             |
| **Border**             | `#E2E2E5` | `226, 226, 229` | Bordures globales, séparateurs             |
| **Input**              | `#DCDFE4` | `220, 223, 228` | Bordures de champs de formulaire           |
| **Ring**               | `#3B6BF8` | `59, 107, 248`  | Focus ring (accessibilité)                 |
| **Destructive**        | `#DC2626` | `220, 38, 38`   | Erreurs, alertes critiques                 |

### Dark mode (`.dark`)

| Nom fonctionnel        | HEX         | RGB                  | Usage                                 |
| ---------------------- | ----------- | -------------------- | ------------------------------------- |
| **Background**         | `#191B23`   | `25, 27, 35`         | Fond de page dark                     |
| **Foreground**         | `#F8F8FA`   | `248, 248, 250`      | Texte principal dark                  |
| **Surface**            | `#23252D`   | `35, 37, 45`         | Surfaces surélevées                   |
| **Card**               | `#262830`   | `38, 40, 48`         | Cartes dark                           |
| **Primary**            | `#F8F8FA`   | `248, 248, 250`      | Boutons primaires inversés            |
| **Primary Foreground** | `#191B23`   | `25, 27, 35`         | Texte sur Primary dark                |
| **Secondary**          | `#303239`   | `48, 50, 57`         | Boutons secondaires dark              |
| **Muted**              | `#2D2F37`   | `45, 47, 55`         | Zones désactivées dark                |
| **Muted Foreground**   | `#A6A6AD`   | `166, 166, 173`      | Texte secondaire dark                 |
| **Brand**              | `#4D7BF9`   | `77, 123, 249`       | CTA et accents (légèrement éclaircis) |
| **Brand Glow**         | `#8DA3FB`   | `141, 163, 251`      | Glow plus marqué en dark              |
| **Accent**             | `#B166F4`   | `177, 102, 244`      | Accent violet éclairci                |
| **Border**             | `#FFFFFF14` | `255, 255, 255 / 8%` | Bordures translucides                 |
| **Ring**               | `#5C8BFB`   | `92, 139, 251`       | Focus ring dark                       |
| **Destructive**        | `#EF4444`   | `239, 68, 68`        | Erreurs dark                          |

---

## 3. Typographie

**Famille unique** : `Inter` (system-ui fallback). Pas de police display distincte — `--font-display` pointe aussi vers `Inter`.

### Hiérarchie

| Rôle                | Taille             | Graisse          | Line height | Tracking  | Exemple                                 |
| ------------------- | ------------------ | ---------------- | ----------- | --------- | --------------------------------------- |
| **H1 (Hero)**       | `5xl → 7xl → 88px` | `semibold (600)` | `0.95`      | `-0.04em` | Titre principal hero                    |
| **H2 (Section)**    | `4xl → 5xl → 6xl`  | `semibold (600)` | `1.1`       | `-0.03em` | Titres de section                       |
| **H3 (Card title)** | `xl → 2xl`         | `semibold (600)` | `1.2`       | `-0.02em` | Titres de cartes services               |
| **Body**            | `base → lg`        | `normal (400)`   | `1.6`       | normal    | Paragraphes, descriptions               |
| **Small / Caption** | `xs → sm`          | `medium (500)`   | `1.5`       | normal    | Labels, badges, metadata                |
| **Eyebrow**         | `xs`               | `medium (500)`   | `1`         | `0.2em`   | Catégories, labels au-dessus des titres |

### Tableau récapitulatif Tailwind

```
H1   : text-5xl sm:text-6xl md:text-7xl lg:text-[88px] font-display font-semibold tracking-[-0.04em] leading-[0.95]
H2   : text-4xl sm:text-5xl md:text-6xl font-display font-semibold tracking-[-0.03em]
H3   : text-xl sm:text-2xl font-display font-semibold tracking-tight
Body : text-base sm:text-lg text-muted-foreground
Small: text-xs sm:text-sm font-medium
Eyebrow: text-xs font-medium uppercase tracking-[0.2em] text-brand
```

### Notes

- `text-balance` est appliqué sur les titres et sous-titres pour éviter les orphelins.
- `font-feature-settings: "ss01", "cv11"` est activé sur `<body>` pour optimiser l'affichage d'Inter.

---

## 4. Logo et marques

### Fichiers trouvés

| Fichier        | Chemin relatif        | Description                                                |
| -------------- | --------------------- | ---------------------------------------------------------- |
| `logo.svg`     | `public/logo.svg`     | Logo principal (357×296, multi-paths, palette violet-bleu) |
| `logo (1).svg` | `public/logo (1).svg` | Logo alternatif (357×425, chemin fermé, même palette)      |

### Palette du logo (couleurs extraites des SVG)

| Couleur         | HEX       | Usage dans le logo |
| --------------- | --------- | ------------------ |
| Bleu électrique | `#3961F8` | Formes principales |
| Violet profond  | `#7928CA` | Accents centraux   |
| Violet vif      | `#8147F9` | Pièces lumineuses  |
| Indigo foncé    | `#1E144E` | Ombres, contours   |

### Règles d'usage

1. **Fond clair** : utiliser le logo sur fond blanc ou très clair. Ne jamais superposer sur des images sans contraste suffisant.
2. **Fond sombre** : privilégier une version inversée (contours blancs) ou ajouter un fond solide.
3. **Zone de protection** : prévoir un espace libre équivalent à 50% de la hauteur du logo sur chaque côté.
4. **Taille minimale** : ne pas descendre en dessous de 32px de hauteur pour le logo seul.
5. **À éviter** : déformer, appliquer des ombres portées supplémentaires, changer les couleurs, recadrer.
6. **Usage dans le header** : `h-8 w-auto` (32px) dans la navbar flottante.
7. **Usage dans le footer** : `h-12 w-auto` (48px).

---

## 5. Éléments UI

### Boutons

| Variante  | Style                                 | Arrondi        | Ombre / Effet                                                                              |
| --------- | ------------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| `default` | `bg-primary text-primary-foreground`  | `rounded-full` | `shadow` + hover `opacity/90`                                                              |
| `brand`   | `bg-brand text-brand-foreground`      | `rounded-full` | `shadow-[0_8px_24px_-8px_brand]` + hover `shadow-[0_12px_32px]` + `hover:-translate-y-0.5` |
| `hero`    | `bg-foreground text-background`       | `rounded-full` | `shadow-[0_10px_30px_-12px foreground/60%]` + `hover:-translate-y-0.5`                     |
| `glass`   | `bg-background/40 backdrop-blur-xl`   | `rounded-full` | `border border-border` + hover `bg-background/60`                                          |
| `outline` | `border border-border bg-transparent` | `rounded-full` | hover `bg-secondary`                                                                       |
| `ghost`   | `bg-transparent`                      | `rounded-full` | hover `bg-secondary`                                                                       |
| `link`    | `text-brand underline-offset-4`       | `rounded-none` | hover `underline`                                                                          |

**Tailles** : `sm` (32px), `default` (40px), `lg` (48px), `xl` (56px), `icon` (40×40).
**Transitions** : `transition-all duration-300`, easing `cubic-bezier(0.22, 1, 0.36, 1)`.
**États** : `active:scale-[0.98]`, `disabled:opacity-50 disabled:pointer-events-none`.

### Cartes

| Type             | Arrondi              | Bordure         | Ombre                        | Hover                                                                        |
| ---------------- | -------------------- | --------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| **Project card** | `rounded-2xl` (16px) | `border-border` | `shadow-card`                | `hover:-translate-y-1` + `hover:border-brand/40` + `hover:shadow-[...brand]` |
| **Service card** | `rounded-2xl`        | `border-border` | none (ajouté au hover)       | `hover:-translate-y-1` + `hover:border-brand/40` + `hover:shadow-[...brand]` |
| **CTA strip**    | `rounded-3xl` (24px) | `border-border` | `shadow-[...foreground/25%]` | none                                                                         |
| **Contact form** | `rounded-3xl`        | `border-border` | `shadow-[...foreground/25%]` | none                                                                         |

**Contenu typique** : badge eyebrow (`rounded-full bg-black/30 text-[10px] uppercase tracking-[0.18em]`), tags (`rounded-full border bg-background/60 text-[10px]`).

### Navigation

- **Navbar** : `fixed inset-x-0 top-0 z-50`, conteneur `rounded-full`, `bg-background/60 backdrop-blur-xl`, `border border-border`, `shadow-[0_8px_30px_-12px foreground/15%]`.
- **Liens nav** : `rounded-full px-3 py-1.5 text-sm`, état actif `bg-secondary text-foreground`.
- **CTA header** : `variant="brand" size="sm"`.
- **Locale switcher** : `rounded-full border bg-background/40 p-0.5 text-xs backdrop-blur-md`.

---

## 6. Exemples d'application

### 6.1 Header (Navbar flottante)

```html
<nav class="fixed inset-x-0 top-0 z-50 mt-4 flex justify-center px-4">
  <div
    class="flex items-center gap-4 rounded-full border border-border bg-background/60 px-4 py-2 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]"
  >
    <img src="/logo.svg" alt="WebXIA" class="h-8 w-auto" />
    <span class="font-display text-base font-semibold tracking-tight"
      >WebXIA<span class="text-brand">.</span></span
    >
    <a href="#" class="rounded-full px-3 py-1.5 text-sm bg-secondary text-foreground">Accueil</a>
    <a href="#" class="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
      >Services</a
    >
    <a href="#" class="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
      >Réalisations</a
    >
    <a
      href="#"
      class="ml-auto rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-[0_8px_24px_-8px_var(--brand)] hover:shadow-[0_12px_32px_-8px_var(--brand)] hover:-translate-y-0.5 transition-all duration-300"
      >Contact</a
    >
  </div>
</nav>
```

### 6.2 Bouton CTA (Hero)

```html
<button
  class="relative overflow-hidden rounded-full bg-foreground px-9 py-4 text-base font-medium text-background shadow-[0_10px_30px_-12px_rgba(38,38,41,0.6)] hover:bg-foreground/90 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98]"
>
  Démarrer un projet
</button>
```

### 6.3 Carte de projet

```html
<article
  class="group rounded-2xl border border-border bg-card overflow-hidden hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_30px_80px_-30px_rgba(29,78,216,0.4)] transition-all duration-300"
>
  <div class="relative aspect-[4/3] bg-muted">
    <span
      class="absolute top-3 left-3 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur-md"
      >E-commerce</span
    >
  </div>
  <div class="p-5">
    <h3 class="font-display text-lg font-semibold leading-tight tracking-tight">Nom du projet</h3>
    <div class="mt-3 flex flex-wrap gap-1.5">
      <span
        class="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
        >React</span
      >
      <span
        class="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
        >Supabase</span
      >
    </div>
  </div>
</article>
```

### 6.4 Post social (eyebrow + titre + gradient)

```html
<section class="py-20">
  <p class="text-xs font-medium uppercase tracking-[0.2em] text-brand mb-4">Nos services</p>
  <h2
    class="font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl"
  >
    Construire
    <span
      class="bg-gradient-to-r from-foreground via-brand to-brand-glow bg-clip-text text-transparent"
      >l'avenir digital</span
    >
  </h2>
  <p class="mt-4 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
    Des solutions web sur mesure pour les entreprises ambitieuses.
  </p>
</section>
```

### 6.5 Signature email

```
---
[Prénom] [Nom]
WebXIA — Agence Web

Site : https://webxia.dev
Mail : contact@webxia.dev

Logo en pièce jointe (format SVG, fond transparent).
Couleurs brand : #1D4ED8 (bleu) / #9333EA (violet)
```

---

## 7. Variables CSS / tokens

Tous les tokens sont définis dans `src/styles.css` et utilisables via `var(--token)` ou les classes Tailwind correspondantes.

### Couleurs

```css
/* Light mode (:root) */
--background: #fcfcfd; /* oklch(0.99 0.002 240) */
--foreground: #262629; /* oklch(0.18 0.02 260) */
--surface: #f6f6f8; /* oklch(0.97 0.004 240) */
--surface-elevated: #ffffff; /* oklch(1 0 0) */
--card: #ffffff; /* oklch(1 0 0) */
--card-foreground: #262629; /* oklch(0.18 0.02 260) */
--primary: #262629; /* oklch(0.18 0.02 260) */
--primary-foreground: #fcfcfd; /* oklch(0.99 0.002 240) */
--secondary: #f4f4f5; /* oklch(0.96 0.005 240) */
--secondary-foreground: #262629;
--muted: #f4f4f5; /* oklch(0.96 0.005 240) */
--muted-foreground: #7c7c85; /* oklch(0.5 0.015 260) */
--brand: #1d4ed8; /* oklch(0.62 0.2 258) */
--brand-foreground: #fcfcfd;
--brand-glow: #6d8df5; /* oklch(0.72 0.18 270) */
--accent: #9333ea; /* oklch(0.72 0.16 295) */
--accent-foreground: #262629;
--destructive: #dc2626; /* oklch(0.6 0.22 25) */
--destructive-foreground: #fcfcfd;
--border: #e2e2e5; /* oklch(0.9 0.008 250) */
--input: #dcdfe4; /* oklch(0.92 0.008 250) */
--ring: #3b6bf8; /* oklch(0.62 0.18 255) */

/* Dark mode (.dark) */
--background: #191b23;
--foreground: #f8f8fa;
--surface: #23252d;
--surface-elevated: #2a2c34;
--card: #262830;
--card-foreground: #f8f8fa;
--primary: #f8f8fa;
--primary-foreground: #191b23;
--secondary: #303239;
--secondary-foreground: #f8f8fa;
--muted: #2d2f37;
--muted-foreground: #a6a6ad;
--brand: #4d7bf9;
--brand-foreground: #191b23;
--brand-glow: #8da3fb;
--accent: #b166f4;
--accent-foreground: #191b23;
--destructive: #ef4444;
--destructive-foreground: #f8f8fa;
--border: rgba(255, 255, 255, 0.08);
--input: rgba(255, 255, 255, 0.12);
--ring: #5c8bfb;
```

### Polices

```css
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
--font-display: "Inter", ui-sans-serif, system-ui, sans-serif;
```

### Rayons

```css
--radius: 0.75rem;            /* 12px — base */
--radius-sm: calc(var(--radius) - 4px);  /* 8px */
--radius-md: calc(var(--radius) - 2px);  /* 10px */
--radius-lg: var(--radius);              /* 12px */
--radius-xl: calc(var(--radius) + 4px);  /* 16px */
--radius-2xl: calc(var(--radius) + 8px); /* 20px */

/* Patterns utilitaires */
rounded-full  → boutons, badges, nav pills
rounded-2xl    → cartes (16px)
rounded-3xl    → CTA strips, formulaires (24px)
rounded-xl     → icônes containers, champs
```

### Ombres

```css
--shadow-glow:
  0 0 0 1px color-mix(in oklab, var(--brand) 25%, transparent),
  0 20px 60px -20px color-mix(in oklab, var(--brand) 40%, transparent);

--shadow-card:
  0 1px 0 0 color-mix(in oklab, var(--foreground) 6%, transparent),
  0 30px 60px -30px color-mix(in oklab, var(--foreground) 30%, transparent);

/* Ombres dynamiques utilisées dans les composants */
shadow-brand-hover: 0 30px 80px -30px color-mix(in oklab, var(--brand) 40%, transparent)
shadow-cta: 0 10px 30px -12px color-mix(in oklab, var(--foreground) 60%, transparent)
shadow-floating: 0 20px 50px -12px color-mix(in oklab, var(--foreground) 60%, transparent)
```

### Espacements (patterns fréquents)

```css
/* Sections */
py-20  → padding vertical sections
py-24  → padding vertical hero
px-4   → padding horizontal container

/* Contenu interne */
p-6    → padding cartes services
p-10   → padding CTA strips / formulaires
gap-2   → espacement items inline
gap-1.5 → espacement tags/badges

/* Marges */
mb-4   → marge sous eyebrow
mt-3   → marge sous titre dans carte
mt-4   → marge navbar top
```

### Animations

```css
/* Transition standard */
transition-all duration-300
easing: cubic-bezier(0.22, 1, 0.36, 1)

/* Float lent */
@keyframes float-slow {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
  50%      { transform: translate3d(0, -14px, 0) rotate(2deg); }
}
.animate-float-slow { animation: float-slow 9s ease-in-out infinite; }

/* Hover lift */
hover:-translate-y-0.5  → boutons
hover:-translate-y-1    → cartes
hover:scale-[1.03]      → liens CTA inline

/* Active press */
active:scale-[0.98]     → tous les boutons
```

---

_Document généré automatiquement à partir du code source du projet WebXIA._
_Dernière mise à jour : septembre 2026._
