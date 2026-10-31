# Webi RAG — Retrieval-Augmented Generation

> Single source of truth (code): `src/lib/ai/embeddings/config.ts` → `EMBEDDING_CONFIG`.
> Migrations `012/013/014` are **APPLIED** (verified read-only 2026-09-10 and
> re-verified 2026-09-24: `vector(2048)`, HNSW `halfvec(2048)`, RPC
> `match_knowledge_chunks` `service_role`-only, `content_hash` + UNIQUE index).
> Migration `021` is **APPLIED** (business identity `source_key`):
> `source_key text UNIQUE NULL`, re-scoped `content_hash` dedup to legacy rows only.

---

## 1. Architecture

```
admin script / future admin endpoint          /api/chat (anonymous, per-turn)
        ↓                                              ↓
ingestion pipeline                    AgentOrchestrator (automatic retrieval)
  normalize → hash → chunk →               ↓
  batch-embed → persist            buildAgentContext → ragEngine.query
        ↓                                     ↓
KnowledgeRepository  ←———————  Retriever (+ NoOpReranker seam)
  (ONLY Supabase-speaking RAG module)         ↓
        ↓                              ContextBuilder (budgeted KNOWLEDGE)
Supabase / pgvector                           ↓
  match_knowledge_chunks RPC             citations → SSE
  HNSW halfvec(2048) index
```

Separation: ingestion ≠ chunking (`rag/chunker.ts`, pure) ≠ embeddings
(`embeddings/`, provider) ≠ repository (`rag/repository.ts`, sole DB
access) ≠ retrieval (`rag/retriever.ts`, bounds) ≠ context building
(`rag/context-builder.ts`, token budget) ≠ citations (orchestrator SSE).
No monolithic "RAG" function. `PgVectorStore` remains as a thin
`VectorStore`-compatible façade over the repository.

## 2. Embedding model

- Provider: **NVIDIA NIM** (`POST {baseUrl}/v1/embeddings`, `encoding_format: float`).
- Model: **`nvidia/nemotron-3-embed-1b`** (multilingual, retrieval/QA-optimized).
- Dimensions: **2048 native — the only value the API emits** (any reduced
  `dimensions` value returns HTTP 400). Vectors are never truncated, padded,
  sliced or recomputed: mismatches fail loudly (`EmbeddingDimensionError`
  runtime guard + Postgres `vector(2048)` parameter type).
- Env: `NVIDIA_NIM_EMBEDDING_MODEL` overrides the model NAME only;
  dimensions stay controlled by `EMBEDDING_CONFIG`.

## 3. Configuration

`EMBEDDING_CONFIG` (`src/lib/ai/embeddings/config.ts`): provider, model,
`dimensions: 2048`, `defaultTopK: 5`, `defaultThreshold: 0.7`, `maxTopK: 20`.
Consumed by: `NvidiaEmbeddingProvider`, `RAGEngine`, `Retriever` (via
`clampTopK`/`clampThreshold`), `KnowledgeRepository`, ingestion pipeline,
memory-service wiring, tests. No other module hardcodes embedding dimensions.

## 4. Ingestion

Pipeline (`src/lib/ai/rag/ingestion.ts` + `scripts/ingest-knowledge.ts`):

```
SOURCE (.md/.txt) → normalize → sha256 → dedupe? → chunk → batch-embed → persist
```

- `normalizeContent`: CRLF → LF, YAML front-matter stripped, trailing
  spaces removed, 3+ blank lines collapsed.
- `computeContentHash`: sha256 hex of the NORMALIZED content.
- `chunkTextIntoPieces`: paragraphs → sentences → words (hard cut only
  under absolute constraint), `maxChars 2000`, `overlapChars 200`
  (word-aligned reseed), ordered with char offsets + token estimates.
- Same hash + no `--force` → `already_exists`, **zero re-embedding**.
  `--force` deletes then rebuilds (`reindexed`). Concurrent duplicate
  inserts resolve via the DB UNIQUE to `already_exists`.
- Embeddings in batches (default 32), every vector dimension-checked.
- Script is server-only (`scripts/`, never bundled, refuses `window`).

Run: `npx tsx scripts/ingest-knowledge.ts --file ./docs/faq.md --title "FAQ"
--source-type faq --locale fr --tags "faq,tarifs" [--force]`

The script loads `./.env` via `dotenv` (`import "dotenv/config"`, server
only — never bundled, never client). Check env visibility without values:
`npx tsx scripts/ingest-knowledge.ts --help` (prints `set`/`MISSING` per
variable). Shell-exported variables keep priority over `.env`.

## 5. Chunking

See §4. Short documents → exactly 1 chunk. Long documents → ordered
chunks with `chunk_index`, `char_start/char_end`, `token_estimate` in chunk
metadata. Pure module, fully unit-tested (`rag/__tests__/chunker.test.ts`).

## 6. Retrieval

- Per-turn automatic: `buildAgentContext` → `ragEngine.query(userMessage,
{ topK 5, threshold 0.7 })` before every LLM call. NOT a tool-call.
- DB-side: `match_knowledge_chunks(query_embedding vector(2048),
threshold, count≤20, locale?, source_type?)` — cosine similarity **in
  halfvec space** (matches the HNSW expression indexes), threshold filter,
  topK, `service_role` only. Storage stays full-precision `vector(2048)`.
- Empty or below-threshold → **nothing injected, never forced**.
- Embedding/retrieval failure → `agent.rag.failed` event, chat continues
  without knowledge.
- `search_knowledge` skill is OFF the chat path (`CHAT_EXCLUDED_TOOLS`);
  kept for future admin/agent use.

## 7. Seuils

Defaults `topK 5 / threshold 0.7` from `EMBEDDING_CONFIG`; server clamps
`topK ∈ [1, 20]`, `threshold ∈ [0, 1]`.

## 8. Sécurité

- KB globale, lecture serveur (service-role via repository/RPC),
  écriture admin uniquement (RLS `admin_users`), no multi-tenant, no
  per-document user scope. `sessionId` validated (UUID) but never identity.
- `assertRagAccess(ctx)` (rewritten on `admin_users`, never
  `user_metadata.role`): ingestion/purge admin ONLY. Never on the
  anonymous retrieval path (it would reject 100% of traffic).
- RPC `SECURITY DEFINER`, fixed `search_path`, `REVOKE FROM PUBLIC`,
  `GRANT EXECUTE` to `service_role` only.

## 9. Citations

Derived ONLY from server retrieval (`chunk_id/document_id/chunk_index`
kept separate end-to-end: RPC → repository → retriever → `ScoredDocument`
→ context → `Citation` → SSE). The LLM never invents references. Excerpts
come from real chunk content (≤ 200 chars). SSE `citation` events carry
`source/excerpt/relevance/documentId/chunkId/title/chunkIndex`.

## 10. Événements

`agent.rag.queried {queryLength, topK, threshold, strategy}`,
`agent.rag.completed {results, totalFound, topScore, documentIds,
retrievalMs, embeddingMs}`, `agent.rag.failed {stage, code}`.
Payloads never contain queries, user content, chunk content or secrets.

## 11. Content hash (legacy) & source_key (métier)

Depuis la migration `021`, les documents knowledge portent DEUX notions
d'identité, strictement distinctes (voir §14) :

- `knowledge_documents.source_key` (**identité métier**, stable) : clé
  `sourceType:slug:locale:version` pour les documents éditoriaux
  (`article` | `realisation` | `service`). C'est LA clé de déduplication
  de tout document métier. Voir §14.
- `knowledge_documents.content_hash` (migration 014, UNIQUE) : sha256 du
  contenu normalisé. **Re-scope (021)** : la déduplication par hash ne
  concerne plus QUE les lignes **legacy** (`source_key IS NULL`,
  types `website|pdf|manual|faq|blog|case_study`). `findDocumentByHash`
  applique donc `.is("source_key", null)` — une ligne métier n'est
  JAMAIS retournée par ce lookup. Même contenu → même document legacy,
  quelle que soit la source ; les variantes de locale diffèrent en
  contenu, donc en hash. Les hashes NULL ne collisionnent jamais.

## 12. Procédure d'ingestion

1. Migrations `012/013/014`: APPLIED 2026-09-10 (verified read-only).
   Remaining: apply `015_rag_match_lockdown.sql` via SQL Editor when
   convenient — ingestion works without it, but the validated
   service_role-only posture requires it.
   Migration `021` (identité `source_key`): APPLIED — voir §14.
2. Set server env (`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NVIDIA_NIM_API_KEY`).
3. Run the script (§4 ou §16). Re-run anytime: unchanged files/identities
   are skipped.

## 13. Limites connues

- Index : **HNSW sur expression `(embedding::halfvec(2048))`** (012) —
  HNSW-`vector` étant limité à 2000 dims dans pgvector, et halfvec montant
  à 4000. Paramètres HNSW par défaut (`m=16`, `ef_construction=64`) :
  à revoir past ~100 k chunks si la latence l'exige.
- La RPC interroge en espace halfvec (float16) : tradeoff ANN standard,
  négligeable pour topK+seuil. Le stockage reste `vector(2048)` intact.
- No reranking service yet (`NoOpReranker` seam in place).
- No `status`/draft workflow: any admin-inserted document is immediately live.

## 14. Contrat d'identité (`source_key`)

Code: `src/lib/ai/contracts/source-key.ts` — migration `021`.

### Deux identités, jamais confondues

|        | Lignes **métier**                       | Lignes **legacy**                                                 |
| ------ | --------------------------------------- | ----------------------------------------------------------------- |
| Types  | `article` \| `realisation` \| `service` | `website` \| `pdf` \| `manual` \| `faq` \| `blog` \| `case_study` |
| Clé    | `source_key` (stable, éditable)         | `content_hash` (empreinte du contenu)                             |
| Lookup | `findDocumentByKey(sourceKey)`          | `findDocumentByHash(hash)` — **uniquement** `source_key IS NULL`  |
| Portée | identité éditoriale évolutive           | contenu brut, pas d'identité stable                               |

### Format de `source_key`

```
source_key = `${sourceType}:${slug}:${locale}:${version}`
exemple    = article:audit-seo:fr:3f9a1c2b7d44
```

- **`slug`** : `[a-z0-9]+(-[a-z0-9]+)*` (kebab-case, sortie de slugify).
  Le `:` est interdit dans un segment → la clé reste non ambiguë et
  sûrement parsable (`parseSourceKey` est strict, jamais lossy).
- **`locale`** : `fr` | `en`. Les variantes FR et EN d'un même slug sont
  DEUX documents distincts, jamais une collision.
- **`version`** : empreinte du **contenu** — 12 caractères hex lowercase.
  Éditer le contenu crée une NOUVELLE identité ; éditer seulement les
  métadonnées (titre, tags…) ne la change pas.

### `computeContentVersion` (normalisation v1)

```
version = sha256( normaliser(contenu) )[0..12]   // 12 hex lowercase
normaliser = CRLF → LF, puis trim
```

`NORMALIZE_VERSION = 1` est un **contrat de stabilité** : toute modification
de la normalisation ou de l'algorithme d'empreinte DOIT bump cette
constante ET déclencher une ré-ingestion globale — chaque version
précédemment calculée (et donc chaque `source_key`) devient obsolète.

### Règle de re-hash (déduplication)

- Identité fournie (`options.identity`) → la clé de lookup EST le
  `source_key`. `content_hash` est calculé et stocké, mais ne sert PAS à
  la déduplication des lignes métier.
- Pas d'identité → lookup legacy par `content_hash`, restreint aux lignes
  `source_key IS NULL`.

### Règles d'entrée (`INVALID_IDENTITY`)

L'identité « possède » `sourceType`, `locale` et `version` : les passer
ÉGALEMENT dans l'input d'ingestion (possibilité de divergence) est rejeté
par `resolveIdentity` avec `INVALID_IDENTITY`. Un identifiant fourni rend
donc ces trois champs interdits dans l'entrée. Une repository sans
`findDocumentByKey` lève `REPOSITORY_UNSUPPORTED` dès qu'une identité est
fournie (capacité vérifiée explicitement, jamais assumée).

## 15. Extracteurs purs (`src/lib/ai/rag/extractors/`)

Fonctions **pures** (aucun appel DB, aucun effet de bord), async car
`computeContentVersion` est async. Chacune retourne `null` (rejet) ou un
`ExtractedDocument` prêt pour `ingestDocument`.

| Source         | Fonction                  | Champ de contenu    | Seuil      | URL publique                                            | slug                   | locale      |
| -------------- | ------------------------- | ------------------- | ---------- | ------------------------------------------------------- | ---------------------- | ----------- |
| `articles`     | `extractArticle`          | `content_md`        | ≥ 200 car. | `/journal/{slug}`                                       | slug CMS               | `fr`        |
| `realisations` | `extractRealisation`      | `description_md`    | ≥ 200 car. | `/work/{slug}`                                          | slug CMS               | `fr`        |
| services       | `extractServices(fr, en)` | sections assemblées | —          | `/services#services` (index 0), `/services#section-{i}` | `section-NN` (eyebrow) | `fr` + `en` |

Règles communes :

- **statut `published` uniquement** (brouillon/archivé → `null`) ;
- `slug` non vide sinon `null` ;
- **`version` = empreinte du champ de contenu SEUL** (`content_md` /
  `description_md` / contenu assemblé) — pas du titre ni du chapeau ;
- contenu = `# titre` + (chapeau) + markdown source ;
- métadonnées : seuls les champs sémantiques (slug, tags, category,
  technologies, clientName, featured, excerpt, etc.) — jamais
  `content_html`, `gallery_images`, `project_url`, `github_url`.

Services : 1 document **par section, par locale** (7 FR + 7 EN = 14).
Le `slug` est tiré de l'**eyebrow** (`"01 . SITES INTERNET"` →
`section-01`), jamais du titre marketing → clé stable sous retouche.
Parité FR/EN **exigée** : les deux fichiers doivent avoir le même nombre
de sections (sinon `Error`). Une eyebrow au format invalide lève aussi
une `Error`. Les `source_key` des 14 documents sont uniques et
déterministes.

## 16. CLI `--source` (`scripts/ingest-knowledge.ts`)

Depuis INGEST-3c, la CLI accepte `--source article|realisation|service`.
Les documents source rejoignent la **même boucle de traitement** que le
pipeline fichiers (`--file`/`--dir`) : dry-run, `--batch-size`,
`--max-chunks`, `--max-file-bytes`, `--report`, `--fail-fast` sont
communs.

### Exclusivité de `--source`

`--source` est **exclusif** avec `--file` et `--dir`, ET avec les options
que l'identité « possède » : `--slug`, `--source-type`, `--url`,
`--locale`, `--version`. Toute combinaison lève `CliError
"SOURCE_EXCLUSIVE"` listant **chaque** drapeau en conflit — jamais
d'ignorance silencieuse (défense en profondeur : re-vérifié dans
`runIngestion`, pas seulement au parsing).

### Lecture des lignes (`src/lib/supabase/cli-client.ts`)

Helper **lecture seule**, server-only, réutilisable :

- `requireCliSourceEnv(env?)` : valide `VITE_SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY`. Erreur `MISSING_ENV` **nommant uniquement
  les VARIABLES manquantes** — les valeurs/secrets ne sont jamais
  imprimées.
- `fetchAllPublishedRows(fetchPage, { pageSize })` : boucle de pagination
  robuste. Page par défaut `CLI_PAGE_SIZE = 1000` (cap PostgREST). Arrêt
  documenté : une page **courte** (`data.length < pageSize`) = dernière
  page. 0 résultat → 1 requête ; exactement N pages multiples → la page
  vide finale confirme la fin. Toute erreur PostgREST ou échec de
  transport (timeout, abort) lève `CliSourceError "DB_QUERY_FAILED"`.
- `createPublishedPageFetcher(client, table)` : construit le fetcher
  `select * where status='published' order by id asc range(from, to)` sur
  une table source. Le filtre `status='published'` est appliqué **à la
  source** (les brouillons ne quittent jamais la DB). Tri sur la PK `id`
  (unique + stable ⇒ pas de second critère nécessaire, vérifié au
  compile-time via `satisfies`).

### Dry-run (invariant INGEST-2)

La branche `--dry-run` se situe **au-dessus de tout** appel
`ingestDocument` / embedding / écriture Supabase. Un passage `--source X
--dry-run` prouve l'absence d'effet de bord via le rapport :
`sideEffects = { embeddingsGenerated: false, nvidiaCalls: 0,
databaseWrites: 0 }`.

### Rapport

Le rapport JSON est homogène entre modes fichiers et source. La boucle
unique remplit `mode` (`dry-run` | `ingest`), `source`
(`article` | `realisation` | `service`), `summary`
(`recordsFetched`, `documentsExtracted`, `estimatedChunks`,
`documentsSkipped`, `errors`) et `sideEffects`
(`embeddingsGenerated`, `nvidiaCalls`, `databaseWrites`). Chaque
`FileReport` porte `sourceUrl`, `sourceKey` (identité métier) et
`sourceType` (élargi à `KnowledgeDocType`).

Exécution : `npm run ingest -- --source <kind> --dry-run --report
<plan.json>`. Les métadonnées extraites par les extracteurs (technologies,
etc.) ne sont **pas encore persistées** (pas de champ metadata dans
`IngestionSourceInput` — hors périmètre actuel).
