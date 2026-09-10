-- ============================================
-- MIGRATION 014: KNOWLEDGE CONTENT HASH
-- ============================================
-- Idempotent ingestion: same normalized content -> same hash -> no
-- silent duplicate, no useless re-embedding.
--
-- Identity decision (validated): GLOBAL hash. The knowledge base has no
-- multi-tenancy and no per-user scope; locale-specific variants differ in
-- content (hence in hash) anyway. A byte-identical re-ingest (whatever the
-- source file) resolves to the existing document instead of duplicating it.
-- The hash is computed over NORMALIZED content (see scripts/ingest-knowledge.ts
-- normalizeContent + docs/RAG.md), so trivial whitespace/line-ending
-- differences do not create duplicates.
--
-- Nullable (existing rows, if any, stay valid) + UNIQUE (enforced
-- idempotence at the DB level, race-safe under concurrent ingests).
-- STATUS: CREATED — NOT APPLIED (apply manually via Supabase SQL Editor).

alter table public.knowledge_documents
  add column if not exists content_hash text;

-- Backfill guard: NULL hashes never collide (NULL <> NULL in UNIQUE).
create unique index if not exists uq_knowledge_documents_content_hash
  on public.knowledge_documents (content_hash);

comment on column public.knowledge_documents.content_hash is
  'sha256 of normalized content. Global idempotence key for ingestion (see docs/RAG.md).';
