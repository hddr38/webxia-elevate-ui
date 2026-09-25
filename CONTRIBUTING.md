# Contributing — WebXIA

## Workflow (PR + review, branche `main` protégée)

1. `git checkout main && git pull`
2. Créer une branche : `feat/<sujet>`, `fix/<sujet>`, `chore/<sujet>`, `docs/<sujet>`
3. Petites PR (< 400 lignes si possible), un sujet par PR
4. Avant push : `npm run lint && npm run build && npm run test`
5. Ouvrir la PR `ma-branche → main`, remplir le template, demander une review (`hddr38`, `aelhirech`)
6. Merge uniquement si CI verte + 1 approval. Pas de push direct sur `main`.
7. `git pull --rebase` uniquement sur des commits **non poussés**. Jamais de `push --force` sur l’historique partagé (contrainte Lovable).

## Conventions

- Commits conventionnels : `feat(webi): ...`, `fix(admin): ...`, `chore: ...`, `docs: ...`
- TypeScript strict, pas de `any` (utiliser `unknown` + narrowing)
- Zod sur toutes les entrées de Server Functions
- RLS sur toutes les tables Supabase, `service role` uniquement côté serveur
- Tests : providers LLM mockés, jamais d’appel réel
- Secrets : uniquement dans `.env` local, jamais dans Git, jamais dans Discord/Slack en clair

## Review checklist

- [ ] Pas de secrets / clés dans le diff
- [ ] `npm run lint` + `npm run build` verts
- [ ] Tests ajoutés/maj si logique métier
- [ ] RLS / auth vérifiées si endpoint admin
- [ ] Migrations Supabase relues (pas de perte de données)
