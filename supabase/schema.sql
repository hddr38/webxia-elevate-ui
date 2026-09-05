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
create table public.admin_users (
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
  reading_minutes int not null default 0,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_articles_status on public.articles(status);
create index idx_articles_slug on public.articles(slug);
create index idx_articles_author on public.articles(author_id);
create index idx_articles_published_at on public.articles(published_at desc);
create index idx_articles_category on public.articles using gin (category);
create index idx_articles_tags on public.articles using gin (tags);
create index idx_articles_status_published on public.articles(status, published_at desc) where status = 'published';

comment on table public.articles is 'Blog articles / Journal entries';

-- ============================================
-- REALISATIONS TABLE
-- ============================================
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
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_realisations_status on public.realisations(status);
create index idx_realisations_slug on public.realisations(slug);
create index idx_realisations_author on public.realisations(author_id);
create index idx_realisations_featured on public.realisations(featured) where featured = true;
create index idx_realisations_sort_order on public.realisations(sort_order);
create index idx_realisations_category on public.realisations using gin (category);
create index idx_realisations_technologies on public.realisations using gin (technologies);
create index idx_realisations_status_published on public.realisations(status, published_at desc) where status = 'published';
create index idx_realisations_status_sort on public.realisations(status, sort_order);

comment on table public.realisations is 'Portfolio projects / Realisations';

-- ============================================
-- AI MEMORY TABLE (for future AI agent)
-- ============================================
create table public.ai_memory (
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

create index idx_ai_memory_user_session on public.ai_memory(user_id, session_id);
create index idx_ai_memory_type on public.ai_memory(memory_type);
create index idx_ai_memory_expires on public.ai_memory(expires_at) where expires_at is not null;
create index idx_ai_memory_embedding on public.ai_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);

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
-- Only admins can see admin_users table
create policy "admin_users_select_self" on public.admin_users
  for select using (auth.uid() = user_id);

create policy "admin_users_insert_self" on public.admin_users
  for insert with check (auth.uid() = user_id);

create policy "admin_users_update_self" on public.admin_users
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Only you can delete your own admin record (defense in depth)
create policy "admin_users_delete_self" on public.admin_users
  for delete using (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - ARTICLES
-- ============================================
-- Public can read published articles
create policy "articles_select_published" on public.articles
  for select using (status = 'published');

-- Admins can read ALL articles (including drafts)
create policy "articles_select_admin" on public.articles
  for select using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

-- Only admins can insert articles
create policy "articles_insert_admin" on public.articles
  for insert with check (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

-- Only admins can update articles (and only their own or all if admin)
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

-- Only admins can delete articles
create policy "articles_delete_admin" on public.articles
  for delete using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - REALISATIONS
-- ============================================
-- Public can read published realisations
create policy "realisations_select_published" on public.realisations
  for select using (status = 'published');

-- Admins can read ALL realisations
create policy "realisations_select_admin" on public.realisations
  for select using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

-- Only admins can insert
create policy "realisations_insert_admin" on public.realisations
  for insert with check (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

-- Only admins can update
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

-- Only admins can delete
create policy "realisations_delete_admin" on public.realisations
  for delete using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - AI_MEMORY
-- ============================================
-- Only the owner (admin) can access their AI memory
create policy "ai_memory_select_own" on public.ai_memory
  for select using (auth.uid() = user_id);

create policy "ai_memory_insert_own" on public.ai_memory
  for insert with check (auth.uid() = user_id);

create policy "ai_memory_update_own" on public.ai_memory
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "ai_memory_delete_own" on public.ai_memory
  for delete using (auth.uid() = user_id);

-- ============================================
-- STATS FUNCTIONS
-- ============================================

-- Articles stats
create or replace function public.get_articles_stats()
returns json language sql stable as $$
  select json_build_object(
    'total', count(*),
    'published', count(*) filter (where status = 'published'),
    'drafts', count(*) filter (where status = 'draft')
  )
  from public.articles;
$$;

-- Réalisations stats
create or replace function public.get_realisations_stats()
returns json language sql stable as $$
  select json_build_object(
    'total', count(*),
    'published', count(*) filter (where status = 'published'),
    'drafts', count(*) filter (where status = 'draft'),
    'featured', count(*) filter (where featured = true)
  )
  from public.realisations;
$$;

-- AI Memory stats
create or replace function public.get_memory_stats()
returns json language sql stable as $$
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

-- Auto-create admin_user record on signup (run once manually for your account)
-- insert into public.admin_users (user_id, email, role)
-- select id, email, 'admin' from auth.users where email = 'your-email@example.com';

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