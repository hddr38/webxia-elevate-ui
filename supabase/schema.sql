-- ============================================================
-- SUPABASE SCHEMA - WebXIA (snapshot de production)
-- ============================================================
-- Source de vérité de l'historique DDL : supabase/migrations/* .
-- Ce fichier est un INSTANTANÉ fidèle de l'état production, vérifié par
-- introspection (pg_catalog / information_schema) le 2026-09-24.
-- Usage : bootstrap d'un nouvel environnement + référence de lecture.
-- Il n'est PAS exécuté automatiquement (pas de script lié).
--
-- ÉTAT prod ↔ migrations (LOT 8, 2026-09-24 — historique = 24 entrées) :
--   1. author_id : nullable + ON DELETE SET NULL — migration 002
--      (20260924170000_002_fix_author_id_fk) APPLIQUÉE et baselineée au LOT 8.
--   2. articles.reading_minutes : défaut prod = 5 (le fichier 006 porte 0,
--      mais son rejeu est un no-op : colonne déjà présente → default 5 intact).
--   3. idx_realisations_status_published : CRÉÉ au LOT 8 (1er db push, via 005).
--   4. Ne PAS réintroduire les policies retirées par 019 :
--      admin_users_insert_self, knowledge_documents_select_public,
--      knowledge_chunks_select_public.
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================
create type article_status as enum ('draft', 'published', 'archived');
create type realisation_status as enum ('draft', 'published', 'archived');
create type ai_memory_type as enum ('conversation', 'context', 'knowledge', 'preference');
create type knowledge_doc_type as enum ('website', 'pdf', 'manual', 'faq', 'blog', 'case_study');
create type ai_audit_event_type as enum (
  'auth_failure',
  'rate_limit_exceeded',
  'unauthorized_tool_access',
  'prompt_injection_detected',
  'validation_failure',
  'provider_error',
  'tool_execution_failure',
  'memory_access_violation',
  'rag_access_violation',
  'permission_denied',
  'oversized_payload',
  'context_too_large',
  'max_steps_exceeded',
  'suspicious_activity'
);
create type ai_audit_severity as enum ('low', 'medium', 'high', 'critical');

-- ============================================================
-- ADMIN USERS TABLE
-- ============================================================
create table public.admin_users (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  email text not null unique,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_users is 'Admin users - only one allowed (you)';

-- ============================================================
-- ARTICLES TABLE
-- ============================================================
create table public.articles (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  excerpt text,
  content_md text not null,
  content_html text,
  cover_image_url text,
  status article_status not null default 'draft',
  published_at timestamptz,
  meta_title text,
  meta_description text,
  tags text[] not null default '{}',
  category text[] not null default '{}',
  reading_minutes int not null default 5,  -- défaut prod (006 écrit 0 — écart connu)
  author_id uuid references auth.users(id) on delete set null,  -- 002 appliquée (LOT 8)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_articles_status on public.articles(status);
create index idx_articles_slug on public.articles(slug);
create index idx_articles_author on public.articles(author_id);
create index idx_articles_created_at on public.articles(created_at desc);
create index idx_articles_published_at on public.articles(published_at desc);
create index idx_articles_category on public.articles using gin (category);
create index idx_articles_tags on public.articles using gin (tags);
create index idx_articles_status_published on public.articles(status, published_at desc) where status = 'published';
create index idx_articles_title_trgm on public.articles using gin (title gin_trgm_ops);
create index idx_articles_excerpt_trgm on public.articles using gin (excerpt gin_trgm_ops);

comment on table public.articles is 'Blog articles / Journal entries';

-- ============================================================
-- REALISATIONS TABLE
-- ============================================================
create table public.realisations (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  short_description text,
  description_md text not null,
  description_html text,
  client_name text,
  project_url text,
  github_url text,
  cover_image_url text,
  gallery_images text[] not null default '{}',
  technologies text[] not null default '{}',
  category text[] not null default '{}',
  status realisation_status not null default 'draft',
  published_at timestamptz,
  featured boolean not null default false,
  sort_order int not null default 0,
  meta_title text,
  meta_description text,
  author_id uuid references auth.users(id) on delete set null,  -- 002 appliquée (LOT 8)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_realisations_status on public.realisations(status);
create index idx_realisations_slug on public.realisations(slug);
create index idx_realisations_author on public.realisations(author_id);
create index idx_realisations_created_at on public.realisations(created_at desc);
create index idx_realisations_featured on public.realisations(featured) where featured = true;
create index idx_realisations_sort_order on public.realisations(sort_order);
create index idx_realisations_category on public.realisations using gin (category);
create index idx_realisations_technologies on public.realisations using gin (technologies);
create index idx_realisations_status_sort on public.realisations(status, sort_order);
create index idx_realisations_title_trgm on public.realisations using gin (title gin_trgm_ops);
create index idx_realisations_search_trgm on public.realisations using gin (
  (title || ' ' || coalesce(short_description, '') || ' ' || coalesce(client_name, '')) gin_trgm_ops
);
-- ABSENT en prod (déclaré en 005, jamais créé) — écart connu :
-- create index idx_realisations_status_published
--   on public.realisations(status, published_at desc) where status = 'published';

comment on table public.realisations is 'Portfolio projects / Realisations';

-- ============================================================
-- AI MEMORY TABLE
-- ============================================================
create table public.ai_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  memory_type ai_memory_type not null,
  key text not null,
  value jsonb not null default '{}',
  embedding vector(2048),
  metadata jsonb not null default '{}',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id, memory_type, key)
);

create index idx_ai_memory_user_session on public.ai_memory(user_id, session_id);
create index idx_ai_memory_type on public.ai_memory(memory_type);
create index idx_ai_memory_expires on public.ai_memory(expires_at) where expires_at is not null;
create index idx_ai_memory_embedding on public.ai_memory
  using hnsw ((embedding::halfvec(2048)) halfvec_cosine_ops);
create index idx_ai_memory_key_trgm on public.ai_memory using gin (key gin_trgm_ops);
create index idx_ai_memory_session on public.ai_memory (session_id);
create index idx_ai_memory_type_created on public.ai_memory (memory_type, created_at desc);

comment on table public.ai_memory is 'Persistent memory for AI agent (conversations, context, knowledge, preferences)';
comment on column public.ai_memory.embedding is
  'Embedding nvidia/nemotron-3-embed-1b, 2048 dims natifs. Index HNSW via halfvec(2048). Single source of truth: EMBEDDING_CONFIG.';

-- ============================================================
-- CONVERSATIONS / MESSAGES (Webi chat, anonyme)
-- ============================================================
create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null,
  status text not null default 'active' check (status in ('active','archived','closed')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_conversations_session on public.conversations(session_id, created_at desc);
create index idx_conversations_status on public.conversations(status);
create unique index uq_conversations_one_active_per_session
  on public.conversations (session_id) where status = 'active';
comment on index public.uq_conversations_one_active_per_session is
  'Idempotence guard: a single active conversation per Webi session';

comment on table public.conversations is 'Anonymous chat conversations for Webi - session-isolated via RLS';

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  tool_calls jsonb,
  tool_call_id text,
  tool_name text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_messages_conversation on public.messages(conversation_id, created_at asc);
create index idx_messages_tool_call on public.messages(tool_call_id) where tool_call_id is not null;

comment on table public.messages is 'Chat messages for Webi conversations - session-isolated via conversation RLS';

-- ============================================================
-- KNOWLEDGE BASE (RAG)
-- ============================================================
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
  updated_at timestamptz not null default now(),
  content_hash text  -- 014 : sha256 du contenu normalisé (idempotence ingestion)
);

create index idx_knowledge_documents_source on public.knowledge_documents(source_type, source_url);
create index idx_knowledge_documents_locale on public.knowledge_documents(locale);
create index idx_knowledge_documents_tags on public.knowledge_documents using gin (tags);
create index idx_knowledge_documents_priority on public.knowledge_documents(priority desc);
create unique index uq_knowledge_documents_content_hash
  on public.knowledge_documents (content_hash);
comment on column public.knowledge_documents.content_hash is
  'sha256 of normalized content. Global idempotence key for ingestion (see docs/RAG.md).';

create table public.knowledge_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(2048),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index idx_knowledge_chunks_document on public.knowledge_chunks(document_id);
create index idx_knowledge_chunks_embedding on public.knowledge_chunks
  using hnsw ((embedding::halfvec(2048)) halfvec_cosine_ops);

comment on table public.knowledge_documents is 'RAG Knowledge Base - source documents (websites, PDFs, FAQs, etc.)';
comment on table public.knowledge_chunks is 'RAG Knowledge Base - chunked document segments with embeddings';
comment on column public.knowledge_chunks.embedding is
  'Embedding nvidia/nemotron-3-embed-1b, 2048 dims natifs. Index HNSW via halfvec(2048). Single source of truth: EMBEDDING_CONFIG.';

-- ============================================================
-- AI AUDIT LOG
-- ============================================================
create table public.ai_audit_log (
  id uuid primary key default uuid_generate_v4(),
  event_type ai_audit_event_type not null,
  severity ai_audit_severity not null default 'medium',
  user_id uuid references auth.users(id) on delete set null,
  session_id uuid,
  conversation_id uuid,
  request_id uuid,
  ip_address inet,
  user_agent text,
  event_data jsonb not null default '{}',
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_ai_audit_log_event_type on public.ai_audit_log(event_type);
create index idx_ai_audit_log_session on public.ai_audit_log(session_id);
create index idx_ai_audit_log_conversation on public.ai_audit_log(conversation_id);
create index idx_ai_audit_log_created on public.ai_audit_log(created_at desc);
create index idx_ai_audit_log_severity on public.ai_audit_log(severity);
create index idx_ai_audit_log_user on public.ai_audit_log(user_id);

comment on table public.ai_audit_log is 'Security audit log for Webi agent - tracks security events, auth failures, rate limits, etc.';

-- ============================================================
-- CONTACT MESSAGES (formulaire /contact)
-- ============================================================
create table public.contact_messages (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  company text check (company is null or char_length(company) <= 160),
  budget text check (budget is null or char_length(budget) <= 200),
  message text not null check (char_length(message) between 10 and 5000),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  status text not null default 'new' check (status in ('new', 'read')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contact_messages is 'Briefs déposés via le formulaire de contact (lecture admin uniquement)';

create index idx_contact_messages_created on public.contact_messages(created_at desc);
create index idx_contact_messages_status on public.contact_messages(status);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTIONS
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.update_conversation_timestamp()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

create trigger set_updated_at_admin_users
  before update on public.admin_users
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_articles
  before update on public.articles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_realisations
  before update on public.realisations
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_ai_memory
  before update on public.ai_memory
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_knowledge_documents
  before update on public.knowledge_documents
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_contact_messages
  before update on public.contact_messages
  for each row execute function public.handle_updated_at();

create trigger messages_update_conversation_timestamp
  after insert on public.messages
  for each row execute function public.update_conversation_timestamp();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.admin_users enable row level security;
alter table public.articles enable row level security;
alter table public.realisations enable row level security;
alter table public.ai_memory enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.ai_audit_log enable row level security;
alter table public.contact_messages enable row level security;

-- ============================================================
-- RLS POLICIES - ADMIN_USERS
-- ============================================================
-- Only admins can see admin_users table
create policy "admin_users_select_self" on public.admin_users
  for select using (auth.uid() = user_id);

create policy "admin_users_update_self" on public.admin_users
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "admin_users_delete_self" on public.admin_users
  for delete using (auth.uid() = user_id);

-- RETIRÉ par 019 (LOT 5) — ne pas réintroduire :
--   create policy "admin_users_insert_self" on public.admin_users
--     for insert with check (auth.uid() = user_id);

-- ============================================================
-- RLS POLICIES - ARTICLES
-- ============================================================
create policy "articles_select_published" on public.articles
  for select using (status = 'published');

create policy "articles_select_admin" on public.articles
  for select using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

create policy "articles_insert_admin" on public.articles
  for insert with check (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

create policy "articles_update_admin" on public.articles
  for update using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

create policy "articles_delete_admin" on public.articles
  for delete using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS POLICIES - REALISATIONS
-- ============================================================
create policy "realisations_select_published" on public.realisations
  for select using (status = 'published');

create policy "realisations_select_admin" on public.realisations
  for select using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

create policy "realisations_insert_admin" on public.realisations
  for insert with check (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

create policy "realisations_update_admin" on public.realisations
  for update using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

create policy "realisations_delete_admin" on public.realisations
  for delete using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS POLICIES - AI_MEMORY
-- ============================================================
create policy "ai_memory_select_own" on public.ai_memory
  for select using (auth.uid() = user_id);

create policy "ai_memory_insert_own" on public.ai_memory
  for insert with check (auth.uid() = user_id);

create policy "ai_memory_update_own" on public.ai_memory
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "ai_memory_delete_own" on public.ai_memory
  for delete using (auth.uid() = user_id);

-- ============================================================
-- RLS POLICIES - CONVERSATIONS / MESSAGES (session anonyme)
-- ============================================================
create policy "conversations_select_own_session" on public.conversations
  for select using (session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id'));

create policy "conversations_insert_own_session" on public.conversations
  for insert with check (session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id'));

create policy "conversations_update_own_session" on public.conversations
  for update using (session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id'))
  with check (session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id'));

create policy "conversations_delete_own_session" on public.conversations
  for delete using (session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id'));

create policy "conversations_admin_all" on public.conversations
  for all using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

create policy "messages_select_own_session" on public.messages
  for select using (
    conversation_id in (
      select id from public.conversations
      where session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id')
    )
  );

create policy "messages_insert_own_session" on public.messages
  for insert with check (
    conversation_id in (
      select id from public.conversations
      where session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id')
    )
  );

create policy "messages_admin_all" on public.messages
  for all using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS POLICIES - KNOWLEDGE BASE (service_role only en lecture)
-- ============================================================
-- Aucune policy de lecture publique : les SELECT anon/authenticated sont
-- révoqués en GRANTs ci-dessous (019 / LOT 5). La lecture RAG passe
-- exclusivement par la RPC match_knowledge_chunks (service_role).
create policy "knowledge_documents_admin_all" on public.knowledge_documents
  for all using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

create policy "knowledge_chunks_admin_all" on public.knowledge_chunks
  for all using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- RETIRÉS par 019 (LOT 5) — ne pas réintroduire :
--   knowledge_documents_select_public (for select using (true))
--   knowledge_chunks_select_public    (for select using (...))

-- ============================================================
-- RLS POLICIES - AI AUDIT LOG (admins seulement)
-- ============================================================
create policy "ai_audit_log_admin_read" on public.ai_audit_log
  for select using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

create policy "ai_audit_log_admin_insert" on public.ai_audit_log
  for insert with check (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- ============================================================
-- RLS POLICIES - CONTACT MESSAGES (pas d'insert publique :
-- les briefs arrivent via Server Function / service_role)
-- ============================================================
create policy "contact_messages_select_admin" on public.contact_messages
  for select using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

create policy "contact_messages_update_admin" on public.contact_messages
  for update using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

create policy "contact_messages_delete_admin" on public.contact_messages
  for delete using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

-- ============================================================
-- GRANTS / REVOKE (état production)
-- ============================================================
-- Par défaut, Supabase accorde à anon/authenticated les privilèges DML sur
-- toutes les tables de public (RLS reste le vrai filtre). 019 a révoqué les
-- privilèges sur admin_users et knowledge_* pour supprimer la surface même
-- avant RLS (défense en profondeur).

revoke insert, update, delete, truncate on public.admin_users from anon, authenticated;
revoke select, insert, update, delete, truncate on public.knowledge_documents from anon, authenticated;
revoke select, insert, update, delete, truncate on public.knowledge_chunks from anon, authenticated;

-- ============================================================
-- STATS FUNCTIONS (réservées service_role)
-- ============================================================

create or replace function public.get_articles_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total', count(*),
    'published', count(*) filter (where status = 'published'),
    'drafts', count(*) filter (where status = 'draft')
  )
  from public.articles;
$$;

create or replace function public.get_realisations_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total', count(*),
    'published', count(*) filter (where status = 'published'),
    'drafts', count(*) filter (where status = 'draft'),
    'featured', count(*) filter (where featured = true)
  )
  from public.realisations;
$$;

create or replace function public.get_memory_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total', count(*),
    'sessions', count(distinct session_id),
    'byType', (
      select json_agg(json_build_object('memory_type', memory_type, 'count', cnt))
      from (
        select memory_type, count(*) as cnt
        from public.ai_memory
        group by memory_type
      ) t
    )
  )
  from public.ai_memory;
$$;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

create or replace function public.generate_slug(input_text text)
returns text language sql immutable as $$
  select lower(regexp_replace(input_text, '[^a-z0-9]+', '-', 'g'))
  || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
$$;

-- Auto-create admin_user record on signup (run once manually for your account)
-- insert into public.admin_users (user_id, email, role)
-- select id, email, 'admin' from auth.users where email = 'your-email@example.com';

-- ============================================================
-- RAG RETRIEVAL RPC (013 + lockdown 015)
-- ============================================================
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

comment on function public.match_knowledge_chunks(
  vector(2048), double precision, integer, text, public.knowledge_doc_type
) is
  'Webi RAG retrieval in halfvec space (HNSW): cosine similarity + threshold + topK + filters. service_role only.';

-- Fonctions SECURITY DEFINER : exécution réservée au service_role
-- (le serveur authentifie via adminMiddleware avant d'appeler).
revoke all on function public.get_articles_stats() from public, anon, authenticated;
revoke all on function public.get_realisations_stats() from public, anon, authenticated;
revoke all on function public.get_memory_stats() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.match_knowledge_chunks(
  vector(2048), double precision, integer, text, public.knowledge_doc_type
) from public, anon, authenticated;
grant execute on function public.get_articles_stats() to service_role;
grant execute on function public.get_realisations_stats() to service_role;
grant execute on function public.get_memory_stats() to service_role;
grant execute on function public.is_admin() to service_role;
grant execute on function public.match_knowledge_chunks(
  vector(2048), double precision, integer, text, public.knowledge_doc_type
) to service_role;

-- ============================================================
-- STORAGE BUCKETS (run in Storage dashboard)
-- ============================================================
-- Create buckets: 'covers', 'gallery', 'avatars'
-- Set public access for covers/gallery, private for avatars

-- ============================================================
-- REALTIME (optional - enable in Replication dashboard)
-- ============================================================
-- alter publication supabase_realtime add table articles;
-- alter publication supabase_realtime add table realisations;
