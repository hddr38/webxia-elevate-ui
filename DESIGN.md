# WebXIA — Design System Admin

> Surface : espace d'administration `/admin` (mode _Operate_ — l'utilisateur est en tâche).
> Cohérent avec le thème global du site public (tokens oklch dans `src/styles.css`).
> Références d'intention : dashboards Linear / Vercel / Stripe — sans copier leur identité.

## 1. Couleurs

Toutes les couleurs proviennent des tokens globaux (`src/styles.css`). Aucune couleur hardcodée (`bg-blue-500`, `text-red-600`, …) dans l'admin : utiliser les tokens.

| Token                          | Clair                  | Sombre              | Usage admin                                                         |
| ------------------------------ | ---------------------- | ------------------- | ------------------------------------------------------------------- |
| `background`                   | papier blanc           | zinc profond (0.16) | fond de page                                                        |
| `card`                         | blanc                  | 0.21                | cartes, sidebar, tableaux                                           |
| `surface` / `surface-elevated` | 0.97 / 1               | 0.2 / 0.23          | panneaux superposés                                                 |
| `muted`                        | 0.96                   | 0.24                | surfaces discrètes, skeletons, items actifs de nav                  |
| `muted-foreground`             | 0.5                    | 0.68                | texte secondaire, labels                                            |
| `brand`                        | bleu électrique (258°) | bleu électrique     | accent unique : actions primaires, indicateur actif, tuiles d'icône |
| `accent`                       | violet doux            | violet doux         | hover génériques shadcn uniquement                                  |
| `destructive`                  | rouge 25°              | rouge 25°           | suppression, erreurs                                                |
| `border`                       | gris 0.9               | blanc 8 %           | bordures subtiles                                                   |

**Couleurs sémantiques de statut** (badges, indicateurs — jamais décoratives) :

- Publié : vert (badge `STATUS_BADGE.published`)
- Brouillon : jaune (badge `STATUS_BADGE.draft`)
- Archivé : gris (badge `STATUS_BADGE.archived`)
- Destructif : `destructive` uniquement pour suppression/erreur

**Règle d'accent** : le bleu `brand` est réservé aux actions primaires, à la sélection courante et aux indicateurs d'état. Pas de dégradés violets génériques, pas de glow décoratif.

## 2. Surfaces

| Surface                 | Fond                  | Bordure                            |
| ----------------------- | --------------------- | ---------------------------------- |
| Contenu principal       | `bg-background`       | —                                  |
| Sidebar                 | `bg-card`             | `border-r`                         |
| Carte / widget          | `bg-card`             | `border`                           |
| Carte interactive (KPI) | `bg-card`             | `border` + `hover:border-brand/40` |
| Tableau                 | dans une carte, `p-0` | séparateurs de lignes              |
| Overlay mobile          | `bg-black/50`         | —                                  |
| Popover / menu          | `bg-popover`          | `border` + ombre                   |

Anti-patterns : pas de cartes imbriquées (jamais une Card dans une Card), pas de glassmorphism au-delà d'un léger `backdrop-blur` sur le header sticky, pas de décoration qui gêne la lecture.

## 3. Couleurs de texte

| Rôle                           | Token                        |
| ------------------------------ | ---------------------------- |
| Titre de page (h1)             | `foreground`                 |
| Texte courant                  | `foreground`                 |
| Texte secondaire / description | `muted-foreground`           |
| Données chiffrées              | `foreground`, `tabular-nums` |
| Texte sur action primaire      | `primary-foreground`         |
| Destructif                     | `destructive`                |

Sur une surface colorée, le texte secondaire est teinté depuis la teinte de la surface (jamais un gris neutre).

## 4. Espacements

Échelle Tailwind 4 px. Grille cohérente :

- Page : `p-4 sm:p-6 lg:p-8` (conteneur main), largeur max `max-w-6xl`
- Entre sections : `gap-6` / `space-y-6`
- Entre widgets : `gap-4` (grilles) à `gap-6` (sections)
- Padding carte : `p-6` (header/content), `p-0` pour tableaux
- Padding contrôles : `px-3 py-2.5` (nav), `px-4 py-2` (boutons)
- Plus d'espace au-dessus d'un titre qu'en dessous

## 5. Rayons

Base `--radius: 0.75rem` (12 px). Système unique :

- Cartes / widgets : `rounded-xl`
- Contrôles (boutons, inputs, selects) : `rounded-md` (défaut shadcn)
- Badges / pastilles : `rounded-full`
- Icon tiles KPI : `rounded-lg`

Pas d'apparence « carte jouet » : jamais de rayon > 16 px sur les cartes.

## 6. Ombres

- Cartes : `shadow-xs`/`shadow-sm` discret (le relief vient de la bordure, pas de l'ombre).
- Hover carte interactive : `hover:border-brand/40` + élévation très légère (`hover:-translate-y-0.5`, désactivé si `prefers-reduced-motion`).
- Overlays (menus, dialogs) : ombre du composant shadcn.
- Interdits : halo coloré sans offset, ombre dure `4px 4px 0`, glow néon.

## 7. Typographie

- Famille unique : **Inter** (déjà chargée). `font-feature-settings: "ss01", "cv11"`.
- h1 page : `text-2xl sm:text-3xl font-semibold tracking-tight` — un seul h1 par page, dans le contenu (jamais dans le header sticky).
- Titre de widget (CardTitle) : `text-base font-semibold` ; titre de sous-widget : `text-sm font-medium`.
- Corps / labels : `text-sm` ; description de page : `text-sm text-muted-foreground`.
- Métriques : `text-2xl font-semibold tabular-nums` ; dates et compteurs en `tabular-nums`.
- Mesure de prose : 65–75ch max pour les paragraphes longs ; tableaux denses autorisés au-delà.
- Pas d'eyebrow / kicker au-dessus des titres.

## 8. Icônes

- Bibliothèque unique : **Lucide React** (déjà en place).
- Tailles : `h-4 w-4` (inline, boutons, tableaux), `h-5 w-5` (nav sidebar), `h-3 w-3`/`h-3.5 w-3.5` (micro-indicateurs).
- Toujours `aria-hidden="true"` quand décoratif ; jamais d'emoji dans l'interface.
- Icon tiles KPI : `size-9 rounded-lg bg-brand/10 text-brand` (teinte unique, pas d'arc-en-ciel).
- Icône seule ⇒ `aria-label` **et** tooltip obligatoires.

## 9. États interactifs

| État          | Règle                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hover         | `bg-foreground/[0.04]` sur les items de liste/nav ; `border-brand/40` sur les cartes cliquables ; `underline-offset-4` sur les liens texte       |
| Focus visible | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background` sur tout élément interactif                    |
| Active        | enfoncement discret : `active:translate-y-0` ou scale 0.98 sur boutons principaux                                                                |
| Disabled      | `disabled:opacity-50 disabled:pointer-events-none`                                                                                               |
| Loading       | skeletons `animate-pulse` épousant la forme finale (jamais de spinner au milieu du contenu) ; mutation en cours = icône `Loader2` `animate-spin` |
| Error         | `ListErrorBanner` (`role="alert"`) + action Réessayer ; toasts sonner pour les erreurs transitoires                                              |
| Empty         | `EmptyState` réutilisable : icône, titre, description utile, CTA adapté (voir section empty ci-dessous)                                          |
| Sélection nav | `bg-muted text-foreground font-medium` + `aria-current="page"`                                                                                   |

**Empty states** : distinguer « aucun contenu » (CTA de création) et « aucun résultat pour ces filtres » (bouton réinitialiser). Jamais un zéro seul.

## 10. Responsive

- Breakpoints Tailwind standards (`sm 640`, `md 768`, `lg 1024`, `xl 1280`).
- Sidebar : fixe ≥ `lg` (repliable en mode icônes) ; drawer avec overlay < `lg` (Escape, clic overlay, focus transféré).
- Grilles : KPI `grid-cols-1 md:grid-cols-3` ; widgets `lg:grid-cols-3` avec spans asymétriques (2+1).
- Tableaux : conteneur `overflow-x-auto`, jamais de coupure horizontale de la page ; colonnes critiques conservées sur mobile.
- Header sticky : `h-16`, actions icônes ≥ 44×44 px de zone tactile.
- Contrôles tactiles : `min-h-[44px] min-w-[44px]` sur les boutons icon-only.

## 11. Animation

- Durée : 150–250 ms, `ease-out`. Aucune orchestration de chargement de page.
- Uniquement `transform` et `opacity`. Motion = état (hover, focus, drawer, feedback), jamais décoratif.
- `prefers-reduced-motion` : toutes les transitions/animations s'effondrent (règle globale déjà dans `styles.css`).
- Pas d'animation en boucle infinie hors skeletons de chargement.
- Drawer mobile : `transition-transform duration-200 motion-reduce:transition-none`.

## 12. Navigation admin (règles structurelles)

- Sidebar : logo + badge Admin, nav principale (4 routes réelles), zone basse (Voir le site, profil avec menu : email, Voir le site, Déconnexion).
- Aucune route fictive : pas d'entrée Médias/Paramètres tant que la fonctionnalité n'existe pas.
- Header sticky : toggle sidebar, breadcrumbs cliquables, à droite « Voir le site » + menu utilisateur. Pas de h1 dans le header.
- Breadcrumbs : Administration > Section > Page (Nouveau / Modifier). Dernier segment = page courante, non cliquable.
- Bouton retour : `history.back()` si possible, sinon fallback vers la page parente.
- Navigation clavier complète, `:focus-visible` partout, landmarks `aside`/`header`/`main` (+ skip link).
