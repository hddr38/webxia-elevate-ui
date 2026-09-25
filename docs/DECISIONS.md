# WebXIA — Décisions techniques dépôt (ADR)

> Registre des décisions relatives au dépôt Git et aux workflows GitHub
> (branches, protections, historique). Pour l'historique des migrations,
> voir [`supabase/MIGRATIONS.md`](../supabase/MIGRATIONS.md) ; pour les
> décisions base de données, voir
> [`supabase/DECISIONS.md`](../supabase/DECISIONS.md).

---

## Décision : Branche chore/merge-main-into-webi (supprimée)

**Statut** : accepté · **Lot** : 17 (exécution LOT 16)

### Contexte

Branche de travail utilisée pour intégrer 15 commits (LOTS 5-15)
vers `main` via PR #1 (LOT 16). Merge effectué en fast-forward via
l'API GitHub (méthode `merge`, ni squash ni rebase).

### Décision

Suppression (locale + distante) après vérification que tous ses
commits sont contenus dans `main` :

- contenance vérifiée LOT 17 : `origin/main..origin/chore` vide,
  `merge-base` = `5c47b12` = HEAD de la branche (ancêtre direct) ;
- PR #1 : `closed / merged=True` (merge commit `51ab3dd`) ;
- suppression locale : `git branch -d` (refus non-destructif,
  impossible si non mergée) ;
- suppression distante : `git push origin --delete`.

### Rollback

Branche recréable depuis `origin/main` si nécessaire :

```sh
git branch chore/merge-main-into-webi <hash>
# hash de référence : 5c47b12 (état final de la branche au LOT 16)
```

---

## Décision : Règle de protection main — Require approving reviews

**Statut** : accepté (statu quo) · **Lot** : 17 (constat LOT 16)

### Contexte

La règle « At least 1 approving review is required by reviewers with
write access » bloquait le merge de PR #1 en solo : GitHub refuse
l'auto-approbation de sa propre PR (`Can not approve your own pull
request`). Retirée manuellement par l'admin au LOT 16 pour permettre
l'intégration.

### Constat d'état (audit LOT 17, API, non modifié)

- `GET /repos/{owner}/{repo}/rules/branches/main` → **aucune règle** ;
- protection de branche classique : `protected=False`,
  `required_status_checks: off` ;
- en conséquence, les exigences **PR obligatoire** et **status check
  `build`** (présentes au moment du push LOT 16) sont **elles aussi
  absentes** — ce n'est pas seulement la review qui a été retirée.

### Décision

Règle retirée. Statu quo accepté pour projet solo : aucune règle de
protection active sur `main` à ce jour.

### Alternatives considérées

- **Bypass admin** : non applicable (configuration Rulesets
  indisponible/simplifiée selon le plan du dépôt).
- **2ᵉ reviewer** : impossible en solo.
- **GitHub Pro / Team** : débloquerait la gestion fine des règles et
  des reviewers (à considérer si évolution de l'équipe).

### Révision future

Réactiver au minimum « Require approving reviews » **et** le status
check `build` obligatoire dès qu'un 2ᵉ collaborateur rejoint le
projet, ou dès que le workflow le permet (upgrade Pro/Team). En
l'état, un push direct sur `main` est de nouveau possible — la CI
reste le seul garde-fou automatique.

---

## Anomalie A : 9 commits poussés tardivement

**Statut** : constat documenté · **Lot** : 17 (révélée LOT 16)

### Contexte

Le LOT 16 a poussé 15 commits vers `origin/main` au lieu des 6
attendus. Les 9 commits « bonus » correspondent aux LOTS 5-8
(RLS, schema, migrations) qui n'avaient jamais été poussés depuis
leur création sur la branche `chore/merge-main-into-webi`.

### Cause

Aucun push n'a été effectué entre LOT 5 et LOT 14 : les commits
s'accumulaient localement. La branche `origin/main` est restée
figée sur `4b6dfa0` pendant toute cette période.

### Impact

Aucun (l'intégration est maintenant complète — merge PR #1,
commit `51ab3dd`). L'historique `origin/main` est désormais cohérent
avec le travail local.

### Leçon

Pousser régulièrement (au moins après chaque lot terminé) pour
éviter les accumulations et faciliter le rollback granulaire.
