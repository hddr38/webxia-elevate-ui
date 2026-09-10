-- ============================================
-- MIGRATION 013: RAG MATCH FUNCTION
-- ============================================

create or replace function public.match_knowledge_chunks(
  query_embedding vector(2048),
  match_threshold double precision default 0.7,
  match_count integer default 5,
  filter_locale text default null,
  filter_source_type public.knowledge_doc_type default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  chunk_index integer,
  chunk_content text,
  chunk_metadata jsonb,
  document_title text,
  document_source_type public.knowledge_doc_type,
  document_source_url text,
  document_source_path text,
  document_locale text,
  document_metadata jsonb,
  similarity double precision
)
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    c.metadata,
    d.title,
    d.source_type,
    d.source_url,
    d.source_path,
    d.locale,
    d.metadata,
    1 - (
      (c.embedding::halfvec(2048))
      <=> (query_embedding::halfvec(2048))
    ) as similarity
  from public.knowledge_chunks c
  join public.knowledge_documents d
    on d.id = c.document_id
  where c.embedding is not null
    and (
      filter_locale is null
      or d.locale = filter_locale
    )
    and (
      filter_source_type is null
      or d.source_type = filter_source_type
    )
    and (
      1 - (
        (c.embedding::halfvec(2048))
        <=> (query_embedding::halfvec(2048))
      )
    ) >= match_threshold
  order by
    (c.embedding::halfvec(2048))
    <=> (query_embedding::halfvec(2048))
  limit least(greatest(match_count, 1), 20);
$$;

revoke all
on function public.match_knowledge_chunks(
  vector(2048),
  double precision,
  integer,
  text,
  public.knowledge_doc_type
)
from public;

grant execute
on function public.match_knowledge_chunks(
  vector(2048),
  double precision,
  integer,
  text,
  public.knowledge_doc_type
)
to service_role;

comment on function public.match_knowledge_chunks(
  vector(2048),
  double precision,
  integer,
  text,
  public.knowledge_doc_type
) is
  'Webi RAG retrieval in halfvec space (HNSW): cosine similarity + threshold + topK + filters. service_role only.';
