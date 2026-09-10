-- ============================================
-- MIGRATION 009: CREATE KNOWLEDGE BASE TABLES
-- ============================================
-- Separate from ai_memory - this is the RAG Knowledge Base
-- Stores source documents and their chunked embeddings

-- Document types enum
create type knowledge_doc_type as enum ('website', 'pdf', 'manual', 'faq', 'blog', 'case_study');

-- Knowledge documents (source documents)
create table public.knowledge_documents (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text not null,
  source_type knowledge_doc_type not null,
  source_url text,
  source_path text,
  version text,
  author text,
  locale text not null default 'fr',
  tags text[] not null default '{}',
  priority int not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for source-based queries
create index idx_knowledge_documents_source on public.knowledge_documents(source_type, source_url);
create index idx_knowledge_documents_locale on public.knowledge_documents(locale);
create index idx_knowledge_documents_tags on public.knowledge_documents using gin (tags);
create index idx_knowledge_documents_priority on public.knowledge_documents(priority desc);

-- Knowledge chunks (embedded segments of documents)
create table public.knowledge_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- Vector index for semantic search
create index idx_knowledge_chunks_embedding on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index idx_knowledge_chunks_document on public.knowledge_chunks(document_id);

-- RLS: Enable row level security
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

-- Public read access for published/active documents (for RAG)
create policy "knowledge_documents_select_public" on public.knowledge_documents
  for select using (true);

create policy "knowledge_chunks_select_public" on public.knowledge_chunks
  for select using (
    document_id in (select id from public.knowledge_documents)
  );

-- Admin write access
create policy "knowledge_documents_admin_all" on public.knowledge_documents
  for all using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

create policy "knowledge_chunks_admin_all" on public.knowledge_chunks
  for all using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- Updated at trigger
create trigger set_updated_at_knowledge_documents
  before update on public.knowledge_documents
  for each row execute function public.handle_updated_at();

comment on table public.knowledge_documents is 'RAG Knowledge Base - source documents (websites, PDFs, FAQs, etc.)';
comment on table public.knowledge_chunks is 'RAG Knowledge Base - chunked document segments with embeddings';