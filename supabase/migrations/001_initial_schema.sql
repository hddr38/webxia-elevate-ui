-- ============================================
-- SUPABASE SCHEMA - WebXIA Admin Portal
-- ============================================
-- Run this in Supabase SQL Editor

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ============================================
-- ENUMS
-- ============================================
create type article_status as enum ('draft', 'published', 'archived');
create type realisation_status as enum ('draft', 'published', 'archived');
create type ai_memory_type as enum ('conversation', 'context', 'knowledge', 'preference');

-- ============================================
-- ADMIN USERS TABLE
-- ============================================
create table if not exists public.admin_users (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  email text not null unique,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_users is 'Admin users - only one allowed (you)';

-- ============================================
-- ARTICLES TABLE
-- ============================================
create table if not exists public.articles (
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
  author_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articles_status on public.articles(status);
create index if not exists idx_articles_slug on public.articles(slug);
create index if not exists idx_articles_author on public.articles(author_id);
create index if not exists idx_articles_published_at on public.articles(published_at desc);

comment on table public.articles is 'Blog articles / Journal entries';

-- ============================================
-- REALISATIONS TABLE
-- ============================================
create table if not exists public.realisations (
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
  status realisation_status not null default 'draft',
  published_at timestamptz,
  featured boolean not null default false,
  sort_order int not null default 0,
  meta_title text,
  meta_description text,
  author_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_realisations_status on public.realisations(status);
create index if not exists idx_realisations_slug on public.realisations(slug);
create index if not exists idx_realisations_author on public.realisations(author_id);
create index if not exists idx_realisations_featured on public.realisations(featured) where featured = true;

comment on table public.realisations is 'Portfolio projects / Realisations';

-- ============================================
-- AI MEMORY TABLE (for future AI agent)
-- ============================================
create table if not exists public.ai_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  memory_type ai_memory_type not null,
  key text not null,
  value jsonb not null default '{}',
  embedding vector(1536),
  metadata jsonb not null default '{}',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id, memory_type, key)
);

create index if not exists idx_ai_memory_user_session on public.ai_memory(user_id, session_id);
create index if not exists idx_ai_memory_type on public.ai_memory(memory_type);
create index if not exists idx_ai_memory_expires on public.ai_memory(expires_at) where expires_at is not null;
create index if not exists idx_ai_memory_embedding on public.ai_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);

comment on table public.ai_memory is 'Persistent memory for AI agent (conversations, context, knowledge, preferences)';

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
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

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
alter table public.admin_users enable row level security;
alter table public.articles enable row level security;
alter table public.realisations enable row level security;
alter table public.ai_memory enable row level security;

-- ============================================
-- RLS POLICIES - ADMIN_USERS
-- ============================================
create policy "admin_users_select_self" on public.admin_users
  for select using (auth.uid() = user_id);

create policy "admin_users_insert_self" on public.admin_users
  for insert with check (auth.uid() = user_id);

create policy "admin_users_update_self" on public.admin_users
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "admin_users_delete_self" on public.admin_users
  for delete using (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - ARTICLES
-- ============================================
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

-- ============================================
-- RLS POLICIES - REALISATIONS
-- ============================================
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

-- ============================================
-- RLS POLICIES - AI_MEMORY
-- ============================================
create policy "ai_memory_select_own" on public.ai_memory
  for select using (auth.uid() = user_id);

create policy "ai_memory_insert_own" on public.ai_memory
  for insert with check (auth.uid() = user_id);

create policy "ai_memory_update_own" on public.ai_memory
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "ai_memory_delete_own" on public.ai_memory
  for delete using (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if current user is admin
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

-- Get current admin user id (the internal admin_users.id, not auth user id)
create or replace function public.current_admin_id()
returns uuid language sql stable as $$
  select id from public.admin_users
  where user_id = auth.uid()
  limit 1;
$$;

-- Slug generation helper
create or replace function public.generate_slug(input_text text)
returns text language sql immutable as $$
  select lower(regexp_replace(input_text, '[^a-z0-9]+', '-', 'g'))
  || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
$$;

-- ============================================
-- STORAGE BUCKETS (run in Storage dashboard)
-- ============================================
-- Create buckets: 'covers', 'gallery', 'avatars'
-- Set public access for covers/gallery, private for avatars

-- ============================================
-- REALTIME (optional - enable in Replication dashboard)
-- ============================================
-- alter publication supabase_realtime add table articles;
-- alter publication supabase_realtime add table realisations;
-- alter publication supabase_realtime add table ai_memory;
