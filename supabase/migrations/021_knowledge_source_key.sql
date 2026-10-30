-- ============================================
-- MIGRATION 021: KNOWLEDGE SOURCE KEY (BUSINESS IDENTITY)
-- ============================================
-- Two distinct identity models coexist in `knowledge_documents`:
--
--   LEGACY  (source_key IS NULL)
--     Identity = content_hash (sha256 of the normalized content).
--     Used by the file-based CLI (INGEST-2): website | pdf | manual | faq |
--     blog | case_study documents. Same content -> same document.
--
--   METIER  (source_key IS NOT NULL)
--     Identity = source_key = `<sourceType>:<slug>:<locale>:<version>`
--     (article | realisation | service). The key describes WHICH business
--     document it is; the version segment is the fingerprint of its content.
--     A content edit creates a new identity (the previous revision stays
--     until the purge batch), a metadata-only edit keeps the same identity.
--
-- Consequences of the split:
-- - the content_hash index is re-scoped to the legacy rows only, so a
--   business document may legally share its content with a legacy document
--   (same bytes, two different documents, two different citations);
-- - the source_key index is partial (NULL never collides), so the legacy
--   rows stay valid and untouched.
--
-- Idempotent: every statement is safe to re-run.
-- NOTE: new enum values are only usable after the transaction that adds
-- them has committed -> this migration never references them (no INSERT,
-- no DEFAULT, no index on them).
-- STATUS: CREATED — NOT APPLIED (apply manually via Supabase SQL Editor).

-- 1. Business document types (usable only after this migration commits).
alter type public.knowledge_doc_type add value if not exists 'article';
alter type public.knowledge_doc_type add value if not exists 'realisation';
alter type public.knowledge_doc_type add value if not exists 'service';

-- 2. Stable business identity column (nullable: legacy rows stay valid).
alter table public.knowledge_documents
  add column if not exists source_key text;

comment on column public.knowledge_documents.source_key is
  'Business identity: <sourceType>:<slug>:<locale>:<version>. NULL = legacy document (content_hash identity). See docs/rag/identity.md.';

-- 3. Partial unique index on the business identity (race-safe dedup).
create unique index if not exists uq_knowledge_documents_source_key
  on public.knowledge_documents (source_key)
  where source_key is not null;

-- 4. Re-scope the legacy hash index: LEGACY rows only (source_key IS NULL).
drop index if exists public.uq_knowledge_documents_content_hash;

create unique index if not exists uq_knowledge_documents_content_hash
  on public.knowledge_documents (content_hash)
  where content_hash is not null and source_key is null;

comment on index public.uq_knowledge_documents_source_key is
  'Unique business identity (source_key). Partial: NULL source_key = legacy document.';

comment on index public.uq_knowledge_documents_content_hash is
  'Legacy content-hash identity. Scoped to source_key IS NULL so business documents are not blocked by a shared hash.';
