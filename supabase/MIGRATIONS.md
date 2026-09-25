# WebXIA — Stratégie de migrations Supabase

> Établi au **LOT 7** (2026-09-24, read-only) — **LOT 8 exécuté le 2026-09-24** :
> DDL `002_fix_author_id_fk` appliqué, baseline de **10 marqueurs** insérée
> (`created_by='lot8-baseline'`), premier **`db push --include-all`** réalisé →
> **local = remote = 24 versions, `Remote database is up to date`**.
> État de la base vérifié par introspection `pg_catalog` / `information_schema`.

---

## 1. Référentiel outillage (vérifié, pas supposé)

| Point | Constat |
| --- | --- |
| Supabase CLI installée | **Aucune** (pas de `supabase` en devDependencies, pas global) |
| Version utilisable | `npx supabase@2.117.0` → `2.117.0` (binaire présent dans le cache npx ; `supabase/.temp/cli-latest` = `v2.117.0`) |
| `supabase/config.toml` | **Absent** du dépôt (init testé en environnement éphémère : OK) |
| Scripts npm liés | **Aucun** (`dev/build/lint/typecheck/test` uniquement) |
| CI/CD | **Aucun** (pas de `.github/workflows`) |
| Link projet | **Non** (`~/.supabase` ne contient que traces/télémetrie) |
| Docker / psql | **Absents** → pas de base locale possible |
| Chemin de déploiement réel utilisé | SQL Editor + MCP `supabase_apply_migration` (enregistre `version` = horodatage 14 chiffres + `name`) |

### Comportement CLI confirmé (extraite du binaire + `--help`)

- Parsing des fichiers : regex `^([0-9]+)_(.*)\.sql$` → `version` = tous les
  chiffres avant `_`, `name` = reste. **`001_initial_schema.sql` → version `001`.**
- `migration new <nom>` génère **`<14 chiffres>_<nom>.sql`** (testé : `20260924173624_demo_probe.sql`).
- `db push` (et `--dry-run`) :
  1. **échoue** si une version de `schema_migrations` n'a **pas** de fichier
     local `<version>_*.sql` → `Remote migration versions not found in local migrations directory.` ;
  2. **échoue** si des fichiers locaux sont plus anciens que la dernière
     migration distante et non enregistrés →
     `Found local migration files to be inserted before the last migration on remote database.` (contournable par `--include-all`) ;
  3. n'exécute que les fichiers absents de l'historique.
- Réparation officielle de l'historique : `supabase migration repair --status applied|reverted <version...>`.
- Commandes disponibles : `db {diff,dump,push,pull,reset,lint,start,query,advisors,schema}` et
  `migration {list,new,repair,squash,up,down,fetch}`.

**Conséquence immédiate : `supabase db push` est actuellement *fail-closed*
(il refuse de démarrer), donc aucun rejeu destructeur n'est possible par hasard.**

---

## 2. État de production — **24 entrées** (PK = `version`) · LOT 8

### 2.1 Historique initial (5 entrées, avant LOT 8)

| version | name | Contenu récupéré ? |
| --- | --- | --- |
| `20260730184318` | `002_add_public_columns` | ✅ `statements` lus |
| `20260730185448` | `003_add_missing_indexes` | ✅ `statements` lus |
| `20260910211102` | `add_admin_stats_functions` | ✅ `statements` lus |
| `20260918144043` | `create_contact_messages` | ✅ `statements` lus |
| `20260924163244` | `019_harden_admin_and_knowledge_rls` | ✅ `statements` lus (= LOT 5) |

### 2.2 Ajouts LOT 8 (19 lignes → total **24**)

- **10 baseline** (`created_by='lot8-baseline'`) : `001, 003, 004, 007, 008, 009,
  010, 012, 018` + **`20260924170000_002_fix_author_id_fk`** (voir §4/§5).
- **9 versions enregistrées par la CLI** au 1er push (`created_by` = NULL) :
  `005, 006, 011, 013, 014, 015, 016, 017, 019`.
- Contrôles : 0 doublon, 5 originales intactes, `migration list` local = remote.

### 2.3 Ajout LOT 13 (2026-09-25) → total **25**

- **1 baseline LOT 13** (`created_by='lot13-baseline'`) :
  `20260925093000_harden_advisor_warns` — SQL (1 REVOKE + 3 ALTER
  `search_path`) appliqué via `execute_sql` au **LOT 12 §5**, **non rejoué**
  au LOT 13 (INSERT `ON CONFLICT (version) DO NOTHING` uniquement).
- Contrôles LOT 13 : local **25 fichiers** = distant **25 entrées**, 0 doublon.

---

## 3. Matrice de classification (LOT 7, revérifiée)

Catégories : **A** appliquée et prouvée · **B** historique DB sans fichier local ·
**C** effets présents / attribution incertaine · **D** non appliquée ·
**E** partielle/divergente · **F** nouvelle migration nécessaire.

> **LOT 8** : les actions « Baseline proposée » ont été **exécutées** (§4) ;
> `002` (D) **appliqué** (§5) ; l'index de `005` (E) **créé** (§6).

| Migration | Cat. | Preuve / constat | Action retenue |
| --- | --- | --- | --- |
| `001_initial_schema` | **E** | Tout présent sauf `current_admin_id()` (absente, **jamais utilisée** par l'app) ; policies `admin_users_insert_self` retirées par 019 | Baseline proposée + écart documenté |
| `002_fix_author_id_fk` | **D** | Prod : `author_id NOT NULL` + `ON DELETE CASCADE` (001) ; 002 jamais tourné | **Porte de décision** (§6) — jamais baseline |
| `003_add_stats_functions` | **C** | Stats présentes via jumeau distant `add_admin_stats_functions` (contenu identique) ; la version locale n'a **pas** de `security definer` | Baseline proposée (empêche le rejeu d'effacer le hardening 016) |
| `004_add_memory_stats` | **C** | Idem (`byType` prouve que c'est la version distante qui a tourné) | Baseline proposée (idem) |
| `005_add_composite_indexes` | **E** | 7/8 : `idx_realisations_status_published` **absent** de prod. Explication : les 6 autres viennent des jumeaux distants 002/003, jamais de 005 lui-même | **Non baseline** → le rejeu du 1er push crée l'index manquant (idempotent) |
| `006_add_missing_columns` | **C** | Colonnes créées par `002_add_public_columns` avec `default 5` ; le fichier local (`default 0`) n'a jamais tourné | Non baseline (rejeu = no-op, le default 5 prod est intact) |
| `007_create_conversations` | **A** | Table + policies + index présents | Baseline proposée (rejeu : `create table`/`create policy` échouent) |
| `008_create_messages` | **A** | Table + policies + trigger présents | Baseline proposée (idem) |
| `009_create_knowledge_base` | **A** | Tables + enums + index + trigger présents ; policies publiques retirées par 019 (évolution, pas contradiction) | Baseline proposée — **protège LOT 5** (le rejeu réintroduct `knowledge_*_select_public`) |
| `010_create_audit_log` | **A** | Enums + table + index + policies présents | Baseline proposée (rejeu : `create type`/`create table` échouent) |
| `011_conversation_active_unique` | **A** | `uq_conversations_one_active_per_session` présent | Non baseline (idempotent : rejeu vérifié sans effet) |
| `012_rag_embedding_2048` | **A** | `vector(2048)` ×2 + 2 index HNSW `halfvec(2048)` + comments colonne présents | Baseline proposée (rejeu = DROP+CREATE = rebuild index inutile en prod) |
| `013_rag_match_function` | **A** | RPC présente, ACL `postgres,service_role` | Non baseline (idempotent) |
| `014_knowledge_content_hash` | **A** | Colonne + index UNIQUE + comment présents | Non baseline (idempotent) |
| `015_rag_match_lockdown` | **A** | ACL RPC = `service_role` seul | Non baseline (idempotent) |
| `016_harden_stats_and_search` | **A** | `security definer` + `search_path` + REVOKE/GRANT + index trgm présents | Non baseline (idempotent, re-hardens) |
| `017_backfill_empty_slugs` | **C** | 0 slug vide (état non exclusif) | Non baseline (rejeu : 0 ligne) |
| `018_create_contact_messages` | **A** | Contenu **identique byte-à-byte** au jumeau distant `create_contact_messages` (statements lus) | Baseline proposée (rejeu : `create trigger`/`create policy` échouent) |
| `019_harden_admin_and_knowledge_rls` | **A** | Enregistrée à distance (`20260924163244`) ; twin local `019_…` = même contenu | Non baseline (idempotent) |
| `20260730184318_002_add_public_columns` | **B** | Enregistrée, fichier absent localement → **restauré** | ✅ Fichier créé (contenu exact = `statements`) |
| `20260730185448_003_add_missing_indexes` | **B** | Idem | ✅ Restauré |
| `20260910211102_add_admin_stats_functions` | **B** | Idem | ✅ Restauré |
| `20260918144043_create_contact_messages` | **B** | Idem | ✅ Restauré |
| `20260924163244_019_harden_admin_and_knowledge_rls` | **B** | Idem (contenu = LOT 5) | ✅ Restauré |
| `20260925093000_harden_advisor_warns` | **A** | 1 REVOKE (`rls_auto_enable`) + 3 ALTER `search_path=''` appliqués via `execute_sql` (LOT 12 §5) ; 6 WARN advisors fermés | Baseline `lot13-baseline` (LOT 13) — jamais rejouée |

**Aucune catégorie F** : aucun écart ne justifie une migration neuve *maintenant*
(l'index manquant est par le rejeu de 005 ; `reading_minutes` ne doit pas bouger ; `002` attend une décision).

---

## 4. Baseline — **EXÉCUTÉE au LOT 8** (2026-09-24)

> SQL réellement exécuté (10 lignes, marqueur `lot8-baseline`, transaction
> `BEGIN/COMMIT`, `ON CONFLICT (version) DO NOTHING`). Précondition vérifiée
> (5 lignes), post-vérification : 15 lignes, 0 doublon.

Principe : ne marquer **que** les migrations dont le rejeu échouerait ou
**régresserait** la prod. Toutes les autres restent volontairement non marquées
(rejeu vérifié sans effet) : honnêteté de l'historique > propreté cosmétique.

### 4.1 Preuves exigées (checklist LOT 7 §12) — pour chacune des 9

| # | version | name | effets vérifiés | reste ? | rejeu dangereux ? |
| --- | --- | --- | --- | --- | --- |
| 1 | `001` | `initial_schema` | tables/enums/triggers/policies ✅ | `current_admin_id()` absente (inutilisée) — documenté | ❌ `create type/trigger/policy` échouent **et** recréeraient `admin_users_insert_self` |
| 2 | `003` | `add_stats_functions` | via jumeau distant ✅ | non | ❌ effacerait `security definer`/`search_path` posés par 016 |
| 3 | `004` | `add_memory_stats` | via jumeau distant ✅ | non | ❌ idem |
| 4 | `007` | `create_conversations` | ✅ | non | ❌ `create table`/`create policy` |
| 5 | `008` | `create_messages` | ✅ | non | ❌ idem + `create trigger` |
| 6 | `009` | `create_knowledge_base` | ✅ | non | ❌ échec **+** réintroduct `knowledge_*_select_public` (régression LOT 5) |
| 7 | `010` | `create_audit_log` | ✅ | non | ❌ `create type`/`create table` |
| 8 | `012` | `rag_embedding_2048` | ✅ (colonnes, index, comments) | non | ⚠️ DROP+CREATE = rebuild HNSW |
| 9 | `018` | `create_contact_messages` | ✅ identique au jumeau distant | non | ❌ `create trigger`/`create policy` |

Les 5 entrées historiques existent déjà (pas de doublon possible : PK = `version`).
Aucun fichier marqué ne reste à exécuter. `002` (D), `005` (E) et `017` (C)
sont **exclus volontairement**.

### 4.2 SQL **exécuté** (LOT 8)

```sql
-- PRÉCONDITION (vérifiée : 5 lignes historiques, 0 ligne '001'..)
INSERT INTO supabase_migrations.schema_migrations (version, name, created_by)
VALUES
  ('001',              'initial_schema',          'lot8-baseline'),
  ('003',              'add_stats_functions',     'lot8-baseline'),
  ('004',              'add_memory_stats',        'lot8-baseline'),
  ('007',              'create_conversations',    'lot8-baseline'),
  ('008',              'create_messages',         'lot8-baseline'),
  ('009',              'create_knowledge_base',   'lot8-baseline'),
  ('010',              'create_audit_log',        'lot8-baseline'),
  ('012',              'rag_embedding_2048',      'lot8-baseline'),
  ('018',              'create_contact_messages', 'lot8-baseline'),
  ('20260924170000',   '002_fix_author_id_fk',    'lot8-baseline')
ON CONFLICT (version) DO NOTHING;
-- Post-vérification : 15 lignes (5 + 10), 0 doublon ✅
```

**Piège évité** : `20260730184318` est déjà prise par `002_add_public_columns` —
c'est pourquoi 002 a été renommé `20260924170000_002_fix_author_id_fk.sql`
(version > dernière distante `20260924163244`) **avant** d'être baseline.

**Rollback** : `DELETE FROM supabase_migrations.schema_migrations WHERE created_by = 'lot8-baseline';`
(retour à 5 lignes ; le DDL de 002 reste appliqué — état antérieur à la baseline).

- **Risque** : faible — n'écrit que des marqueurs d'historique, aucun DDL, aucune
  donnée applicative ; PK `version` + `ON CONFLICT DO NOTHING` protègent des doublons.
  Validé en réel par le `db push --dry-run` suivant (002 absent de la liste).
- **Alternative officielle** : `npx supabase@2.117.0 migration repair --status applied …`.

---

## 5. `002_fix_author_id_fk` — **APPLIQUÉ au LOT 8** (2026-09-24)

**Décision produit : appliquer tel quelle** (option retenue) — DDL exécuté en
transaction via `execute_sql` (jamais `apply_migration`), fichier renommé
`20260924170000_002_fix_author_id_fk.sql` et baselineé.

- État avant : `author_id NOT NULL` + `ON DELETE CASCADE` → **supprimer un
  utilisateur `auth.users` supprimait ses articles/réalisations.**
- État après (vérifié) : `delete_rule = 'SET NULL'` sur les 2 FK,
  `is_nullable = 'YES'` sur les 2 colonnes. 2 lignes prod pointent vers
  `47943bec-…` → contenu désormais préservé.

Analyse applicative (à l'origine de la décision) :

- Le serveur injecte `author_id` côté SQL uniquement (`server/functions/articles.ts`,
  `realisations.ts`) ; le client ne peut pas le modifier.
- `src/lib/supabase/database.types.ts` déclare **déjà** `author_id: string | null`
  (le modèle TS attend donc l'état *après* 002).
- L'affichage public n'utilise **pas** la FK : `mappers.ts` force `author: "WebXIA"`.
- Un seul admin (agence) → la suppression d'utilisateur est un cas rare, mais
  l'état actuel transforme ce cas rare en **perte de contenu**.
- 002 est **idempotent** (`drop constraint if exists` + `add constraint` + `drop not null`).

**Recommandation LOT 7 (confirmée et exécutée au LOT 8)** : appliquer tel
quelle — aligne prod et modèle TS (`author_id: string | null`) et supprime le
risque de perte de contenu. L'alternative (déplacer le fichier hors de
`supabase/migrations/`) est désormais caduque : le fichier est renommé,
appliqué et baseline (`20260924170000`) — il ne sera plus jamais rejoué.

---

## 6. Index `idx_realisations_status_published` — **CRÉÉ au LOT 8** (1er push)

- SQL attendu (005, idempotent) :
  `create index if not exists idx_realisations_status_published on public.realisations(status, published_at desc) where status = 'published';`
- Absent de prod (vérifié ; aucune variante sous un autre nom).
- **Utilité réelle : nulle aujourd'hui.** Aucune requête ne trie les
  réalisations par `published_at` :
  - public `getPublishedRealisations` → `status='published'` + `order sort_order asc, created_at desc` → servi par `idx_realisations_status_sort` ;
  - admin → `order created_at desc` → servi par `idx_realisations_created_at` ;
  - seul `getPublishedArticles` trie sur `published_at` → servi par `idx_articles_status_published` (présent).
- **Décision retenue** : ne **pas** créer de migration 020 ;
  laisser le fichier `005` non marqué → le premier push le rejoue et crée
  exactement cet index (seul effet réel de son rejeu). Écart donc comblé sans
  nouveau fichier, sans décision produit.
- **✅ Exécuté** : créé par le `db push` du 2026-09-24, vérifié dans `pg_indexes`
  (seul effet réel des 9 migrations poussées — les 8 autres = no-op vérifiés).

---

## 7. `reading_minutes` — `DEFAULT 5` (prod) vs `DEFAULT 0` (fichier 006)

- **Prod = 5**, issu de la migration historique `002_add_public_columns`
  (`add column if not exists reading_minutes int not null default 5`) — contenu lu dans `statements`.
- Le fichier local 006 (`default 0`) **n'a jamais tourné** (sinon le default serait 0).
- **Le code attend 5** : `lib/admin/schemas.ts` → `.default(5)` ;
  `features/articles/components/ArticleForm.tsx` → `?? 5` ;
  `lib/mappers.ts` → `db.reading_minutes ?? 5`.
- **Conclusion : prod = comportement fonctionnel attendu. Aucune migration de
  correction.** Ne pas toucher au default. Le rejeu de 006 est un no-op
  (`add column if not exists`) : le default 5 prod reste intact.
  Divergence documentée (006 reste tel quel : ce serait falsifier l'historique
  que de le réécrire).

---

## 8. Procédure du workflow — **VALIDÉE EN RÉEL au LOT 8**

Séquence réellement exécutée le 2026-09-24 (dans cet ordre) :

```bash
# 0. aperçu — NE RIEN APPLIQUER
npx supabase@2.117.0 db push --dry-run --include-all --project-ref <ref>

# 1. attendre : seules les lignes attendues doivent apparaître
#    (002 si approuvé, 005 → index manquant, 006/011/013-017/019 → no-ops)
# 2. exécution contrôlée
npx supabase@2.117.0 db push --include-all --project-ref <ref>
# 3. vérifications
npx supabase@2.117.0 migration list --project-ref <ref>
```

Règles permanentes :

1. **Toute nouvelle migration** : nom `<14 chiffres>_<nom>.sql`
   (`npx supabase@2.117.0 migration new <nom>`), appliquée via MCP
   `apply_migration` / SQL Editor **avec le même `version`** → fichier et
   historique restent alignés.
2. Jamais de `db push` sans `--dry-run` préalable.
3. Jamais de baseline « cosmétique » : chaque ligne doit être prouvée (§4.1).
4. `supabase/schema.sql` = instantané de prod (LOT 6), pas une source d'historique.

---

## 9. Validation du workflow

**✅ Validé sur la prod réelle au LOT 8** (2026-09-24) : `migration list` (24/24
aligné) → `db push --dry-run --include-all` (9 fichiers = 005 + 8 no-ops, 002
absent) → `db push --include-all` (9 appliqués, 0 erreur) → re-`dry-run` =
`Remote database is up to date.`

**Jamais validé en environnement isolé** (ni Docker, ni `psql`, ni projet lié,
ni branche Supabase — création de branche = ressource payante, non autorisée).
La validation réelle ci-dessus rend ce point secondaire ; pour un test à vide,
utiliser une branche Supabase (`db push` sur branche, données non propagées).
