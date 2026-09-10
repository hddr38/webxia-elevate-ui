-- ============================================================
-- MIGRATION 015 — LOCKDOWN RAG MATCH FUNCTION
-- ============================================================

REVOKE EXECUTE
ON FUNCTION public.match_knowledge_chunks(
  vector(2048),
  double precision,
  integer,
  text,
  public.knowledge_doc_type
)
FROM anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.match_knowledge_chunks(
  vector(2048),
  double precision,
  integer,
  text,
  public.knowledge_doc_type
)
TO service_role;
