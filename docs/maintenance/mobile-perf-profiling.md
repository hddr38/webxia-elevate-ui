# Protocole de profiling — performance home (scroll)

Objectif : déterminer si le symptôme « sections vides au scroll
haut-bas puis réapparition lente » est JS-bound, raster-bound,
composite-bound, React-bound ou spécifique WebKit. Lecture seule :
aucune modification de code pendant le profiling.

État corrigé avant profiling : sélecteur pathname (`5264375`),
marquee sans `will-change`, MatrixRain IO 600px + DPR cap 1.5
(`828a75c`). Si le symptôme persiste, ce protocole tranche.

## A. Environnement de test

- Navigation privée, cache vidé, extensions désactivées.
- Noter la version exacte de Chrome et l'OS/GPU.
- Build production en local : `npm run build && npm run preview`.
- URL : `http://localhost:4173` (jamais `npm run dev`).
- Phase A : desktop réel (pas d'émulation) avec la manette DevTools.
- Phase B : iPhone 12 + Safari + Web Inspector via Mac (même scénario).

## B. Scénario desktop (Chrome DevTools)

1. Ouvrir la home en `vite preview`, attendre le chargement complet
   (LCP stable, canvas animé, aucun spinner).
2. Ouvrir le panneau Performance, démarrer l'enregistrement.
3. Scroller bas → hero → bas rapidement, 3 cycles complets.
4. Arrêter l'enregistrement, sauvegarder le profil (export JSON).

## C. Mesures à relever

- FPS effectifs et frames dropped pendant les cycles.
- Long tasks : somme et maximum (seuil d'alerte : > 50 ms).
- Répartition du temps : Scripting / Rendering / Painting / System / Idle.
- Activité rAF attribuable au canvas MatrixRain (hero visible ou non).
- Layers composités et mémoire GPU (panneau Layers).
- Re-renders React pendant le scroll (React DevTools Profiler).

## D. Outils DevTools à utiliser

- **Performance panel** : flame chart, Bottom-Up, Call Tree, captures.
- **Rendering panel** : Paint flashing, Layout Shift Regions,
  Frame Rendering Stats, Layer borders.
- **React DevTools Profiler** : enregistrer un scroll, repérer les
  composants re-rendus (suspect historique : racine sans sélecteur).
- **Layers panel** : identifier les layers coûteux (canvas, blur,
  anciens `will-change`).
- **Performance monitor** : CPU, JS heap, listeners, FPS en direct.

## E. Grille d'interprétation

| Signature observée                     | Cause probable    | Prochaine action                     |
| -------------------------------------- | ----------------- | ------------------------------------ |
| Long tasks JS pendant scroll           | JS-bound          | Geler canvas hors champ, réduire rAF |
| Paint/Raster très élevé                | Raster-bound      | content-visibility, réduire blurs    |
| Compositeur saturé, beaucoup de layers | Composite-bound   | Retirer will-change, réduire blurs   |
| Re-renders React répétés               | React-bound       | Sélecteurs précis, memo              |
| Aucun problème mesurable               | WebKit-spécifique | Sentry obligatoire                   |

## F. Décisions par scénario

**Si Raster-bound** : `content-visibility: auto` (+
`contain-intrinsic-size`) sur les sections sous fold ; réduire les
`blur-[120px]` sur mobile ; limiter la zone peinte du canvas.

**Si JS-bound** : mesurer le coût rAF de MatrixRain ; geler le canvas
complètement hors viewport ; traquer les re-renders React au scroll.

**Si Composite-bound** : lister les layers (Layers panel) ; retirer
les `will-change` inutiles ; réduire les `backdrop-blur`.

**Si React re-renders** : profiler pour identifier les composants ;
sélecteurs Zustand/router précis ; mémoïsation ciblée.

**Si aucun problème mesurable** : Chrome ≠ WebKit → installer Sentry
Browser ; tester avec Safari Web Inspector (Mac requis) ; vérifier
GPU, antivirus et mode économie d'énergie du poste.

## G. Checklist manuelle finale

Desktop + iPhone 12 :

- Aucune section vide pendant les 3 cycles.
- Pas de checkerboarding visible (Paint flashing calme).
- Scroll fluide, aucune saccade au retour hero.
- Pas de long task bloquante (> 50 ms).
- CLS < 0,05.
- MatrixRain + marquee visuellement identiques à l'avant-patch.
