# WebXIA — Décisions techniques Supabase (ADR)

> Registre des décisions d'architecture base de données : ce qui a été choisi,
> pourquoi, et ce qui a été explicitement écarté. Pour l'historique des
> migrations, voir [`MIGRATIONS.md`](./MIGRATIONS.md).

---

## Décision : extension_in_public (vector, pg_trgm)

**Statut** : accepté (dette documentée) · **Lot** : 15 (constat LOT 12)

### Contexte

L'advisor sécurité Supabase signale 2 extensions installées dans le schéma
`public` :

- `vector` (pgvector)
- `pg_trgm` (trigram)

Niveau : WARN — lint `extension_in_public` (remediation :
<https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public>).

### Analyse

- **`vector`** : utilisé par `knowledge_chunks.embedding` et
  `ai_memory.embedding` (type `vector(2048)`), par les index HNSW
  (`idx_knowledge_chunks_embedding` en `halfvec(2048) halfvec_cosine_ops`,
  `idx_ai_memory_embedding`) et par le RPC `match_knowledge_chunks`
  (opérateur `<=>`).
- **`pg_trgm`** : utilisé par les index trigram créés au LOT 16
  (`016_harden_stats_and_search` : index de similarité sur les recherches
  admin/stats).

**Migrer ces extensions vers un schéma dédié casserait :**

- les index HNSW (`idx_knowledge_chunks_embedding`, `idx_ai_memory_embedding`) —
  les opérateurs d'index sont liés au schéma d'installation de l'extension ;
- le RPC `match_knowledge_chunks` (opérateur `<=>` non qualifié, opérateurs
  perdus si l'extension change de schéma sans re-création des index) ;
- tout type `vector` non qualifié dans le code SQL existant (migrations,
  `schema.sql`, fonctions) — `SET search_path` ne suffit pas pour tous les
  objets dépendants.

### Décision

**NE PAS corriger.** Le WARN est accepté comme dette documentée. Aucune
migration de schéma d'extension ne sera tentée sans lot dédié avec plan de
rollback et rebuild complet des index + RPC.

### Alternatives rejetées

- **Migration vers schéma `extensions`** : risque de casser les index HNSW et
  le RPC ; nécessite `DROP INDEX`/`CREATE INDEX` + redéploiement — hors
  périmètre et risque élevé pour le pipeline RAG.
- **Noms de types qualifiés partout (`extensions.vector`)** : refactor massif
  (migrations historiques comprises, interdit) — hors périmètre.

### Révision future

Si PostgreSQL 17+ ou une future version Supabase standardise les extensions
hors du schéma `public` (ou fournit un mécanisme de déplacement sûr),
réévaluer dans un lot dédié. Re-vérifier à chaque montée de version majeure
du projet.

---

## Action manuelle : auth_leaked_password_protection

**Statut** : action humaine requise (dashboard) · **Lot** : 15 (constat LOT 12)

### Contexte

L'advisor sécurité Supabase signale que la protection contre les mots de passe
compromis (HaveIBeenPwned) est désactivée pour l'authentification par mot de
passe.

- C'est un **setting du Dashboard Supabase Auth**, pas un objet SQL :
  **aucune migration ni requête ne peut l'activer**.
- L'advisor API security ne le retourne pas toujours ; il figure dans le
  linter du dashboard.

### Procédure (dashboard, humaine)

1. Aller sur <https://supabase.com/dashboard>
2. Sélectionner le projet **WebXIA**
3. **Authentication → Providers → Email → section « Password security »**
4. Activer **« Protect against leaked passwords »**
5. Confirmer l'enregistrement

Référence officielle : <https://supabase.com/docs/guides/auth/password-security>

### Prérequis

- **Plan Pro ou supérieur** (fonctionnalité indisponible en Free).
- Impact : latence d'inscription/réinitialisation légèrement augmentée
  (appel à l'API HaveIBeenPwned — recherche k-anonyme, pas d'envoi du mot de
  passe en clair).

### Vérification post-activation

Relancer les advisors sécurité (dashboard ou API) : le WARN
`auth_leaked_password_protection` doit disparaître. Aucune vérification SQL
possible.
