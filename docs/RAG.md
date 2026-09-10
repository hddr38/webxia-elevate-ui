# Webi RAG — Retrieval-Augmented Generation

> Single source of truth (code): `src/lib/ai/embeddings/config.ts` → `EMBEDDING_CONFIG`.
> Migrations `012/013/014` are **created, not applied** — apply manually via Supabase SQL Editor.

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

## 11. Content hash

`knowledge_documents.content_hash` (migration 014, global UNIQUE):
identity = sha256(normalized content). Same content → same document,
whatever the source file. Locale variants differ in content, hence in
hash. NULL hashes never collide.

## 12. Procédure d'ingestion

1. Migrations `012/013/014`: APPLIED 2026-09-10 (verified read-only).
   Remaining: apply `015_rag_match_lockdown.sql` via SQL Editor when
   convenient — ingestion works without it, but the validated
   service_role-only posture requires it.
2. Set server env (`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NVIDIA_NIM_API_KEY`).
3. Run the script (§4). Re-run anytime: unchanged files are skipped.

## 13. Limites connues

- Index : **HNSW sur expression `(embedding::halfvec(2048))`** (012) —
  HNSW-`vector` étant limité à 2000 dims dans pgvector, et halfvec montant
  à 4000. Paramètres HNSW par défaut (`m=16`, `ef_construction=64`) :
  à revoir past ~100 k chunks si la latence l'exige.
- La RPC interroge en espace halfvec (float16) : tradeoff ANN standard,
  négligeable pour topK+seuil. Le stockage reste `vector(2048)` intact.
- No reranking service yet (`NoOpReranker` seam in place).
- No `status`/draft workflow: any admin-inserted document is immediately live.
