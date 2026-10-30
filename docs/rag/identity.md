# Identité documentaire de la Knowledge Base (INGEST-3a)

> Une **mémoire de connaissance** n'est pas un **document RAG** : `ai_memory` est
> utilisateur, éphémère et conversationnel ; `knowledge_documents` est le
> corpus. Ce document décrit l'identité des documents RAG uniquement.

## 1. Deux modèles d'identité (coexistence assumée)

|          | Legacy                                                                 | Métier                                                                   |
| -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Colonnes | `content_hash`                                                         | `source_key` (+ `source_type`, `locale`, `version`)                      |
| Types    | `website`, `pdf`, `manual`, `faq`, `blog`, `case_study`                | `article`, `realisation`, `service`                                      |
| Identité | contenu normalisé (sha256)                                             | `<sourceType>:<slug>:<locale>:<version>`                                 |
| Index    | `uq_knowledge_documents_content_hash` (partiel : `source_key IS NULL`) | `uq_knowledge_documents_source_key` (partiel : `source_key IS NOT NULL`) |
| Usage    | CLI fichier (INGEST-2)                                                 | Extracteurs business (INGEST-3b)                                         |

**Règle de séparation (migration 021)** :

- une ligne **Legacy** a `source_key IS NULL` → son identité est son
  `content_hash` ;
- une ligne **Métier** a `source_key NOT NULL` → son identité est sa
  `source_key` ;
- les deux index uniques sont **partiels** : un hash partagé entre une ligne
  Legacy et une ligne Métier est **légal** (deux documents différents, deux
  citations différentes) ; un `source_key` dupliqué ou un hash dupliqué parmi
  deux lignes Legacy sont **interdits**.

## 2. Format de `source_key`

```
source_key = `${sourceType}:${slug}:${locale}:${version}`

article:audit-seo:fr:3f9a1c2b7d44
realisation:site-vitrine:fr:9c1d0e77aa12
service:section-01:en:44b7c0a9f31d
```

| Segment      | Valeurs                                 | Règle                                                                 |
| ------------ | --------------------------------------- | --------------------------------------------------------------------- |
| `sourceType` | `article` \| `realisation` \| `service` | type de document métier                                               |
| `slug`       | `[a-z0-9-]+`                            | sortie de `slugify` ; `:` est donc impossible → la clé reste parsable |
| `locale`     | `fr` \| `en`                            | langue **du contenu** (pas de l'UI)                                   |
| `version`    | 12 hex (`[0-9a-f]{12}`)                 | empreinte du contenu (`computeContentVersion`)                        |

La locale fait partie de la clé : la variante FR et la variante EN d'un même
slug sont **deux documents**, jamais une collision. La clé est validée à
l'exécution par `SourceKeySchema` (Zod) et les segments sont validés par
`MemorySourceIdentitySchema`.

Contrat TypeScript : `src/lib/ai/contracts/source-key.ts`
(`MemorySourceIdentity`, `buildSourceKey`, `parseSourceKey`,
`computeContentVersion`, `NORMALIZE_VERSION`).

## 3. Versions et `NORMALIZE_VERSION`

`version` = empreinte du contenu : `sha256(normalisation(contenu))`, les 12
premiers caractères hexadécimaux.

- contenu modifié → nouvelle `version` → **nouvelle identité** (l'ancienne
  révision reste en base jusqu'au lot de purge) ;
- métadonnées seules modifiées (tags, priorité, auteur) → contenu inchangé →
  **même identité** → ingestion idempotente (`already_exists`) ;
- la locale n'est jamais fusionnée : `fr` et `en` ont des versions distinctes.

`NORMALIZE_VERSION = 1` est le **contrat de stabilité** de la normalisation
(CRLF → LF puis `trim`). Si la normalisation — ou l'algorithme d'empreinte —
change, alors :

1. incrémenter `NORMALIZE_VERSION` ;
2. **déclencher une re-ingestion globale** : toutes les `version` calculées
   jusqu'ici sont invalides, donc toutes les `source_key` le sont aussi.

Sans cette étape, l'ancien et le nouveau calcul cohabiteraient et le même
document aurait deux identités concurrentes.

## 4. Comportement du pipeline

| Situation                   | Lookup                                                 | Résultat                             |
| --------------------------- | ------------------------------------------------------ | ------------------------------------ |
| ingestion **sans** identité | `findDocumentByHash(hash)` (rows `source_key IS NULL`) | `already_exists` si le hash existe   |
| ingestion **avec** identité | `findDocumentByKey(source_key)`                        | `already_exists` si la clé existe    |
| course sur l'index unique   | re-lookup sur le **même** jeton (clé ou hash)          | `already_exists` (jamais de doublon) |
| `forceReindex`              | le document existant est supprimé puis reconstruit     | `reindexed`                          |

Quand une identité est fournie, elle **possède** le `sourceType`, la `locale`
et la `version` du document : ces champs ne doivent pas être fournis une
seconde fois via l'input d'ingestion (une divergence rendrait la ligne
incohérente avec sa propre clé → erreur typée `INVALID_IDENTITY`).

## 5. Migration 021 — application manuelle

`supabase/migrations/021_knowledge_source_key.sql` est **créée mais non
appliquée** (convention des migrations 014/020). Elle :

1. ajoute `article`, `realisation`, `service` à l'enum `knowledge_doc_type`
   (sans les référencer dans la même transaction) ;
2. ajoute la colonne nullable `source_key` ;
3. crée l'index unique partiel `uq_knowledge_documents_source_key` ;
4. re-scope `uq_knowledge_documents_content_hash` aux lignes
   `source_key IS NULL`.

Application : **SQL Editor Supabase**, manuellement, avant tout push.

### Régénération des types (obligatoire après application)

`src/lib/supabase/database.types.ts` a été mis à jour **à la main et
temporairement** (colonne `source_key` + enum étendu) pour que le typecheck
passe avant l'application de la migration. Après application :

```bash
npx supabase gen types typescript --project-id <id> --schema public > src/lib/supabase/database.types.ts
```

## 6. Limites connues

- Le type partagé `DocumentSource` (dans `contracts/domain.ts`) ne modélise
  encore que les 6 types Legacy : l'élargissement aux types métier est fait
  dans INGEST-3b. La valeur runtime est conservée telle quelle côté
  repository.
- `findDocumentByKey` est une capacité **optionnelle** de l'interface
  `KnowledgeRepository` (les doubles de test Legacy restent valides) ; le
  repository Supabase l'implémente toujours et l'ingestion l'exige dès qu'une
  identité est fournie.
- La purge des révisions obsolètes (`source_key LIKE '<type>:<slug>:<locale>:%'`)
  n'est pas implémentée : elle relève du lot de purge (INGEST-4).
