-- Lot D admin : durcissement + recherche
-- 1. Fonctions de stats réservées au service_role (le serveur authentifie déjà
--    via adminMiddleware). Sans REVOKE, un SECURITY DEFINER exposerait les
--    totaux (dont brouillons) aux appelants anonymes.
-- 2. search_path fixé (bonne pratique SECURITY DEFINER).
-- 3. Index trigram pour les recherches admin `%terme%` + index ai_memory.

create extension if not exists pg_trgm;

-- Articles stats
create or replace function public.get_articles_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total', count(*),
    'published', count(*) filter (where status = 'published'),
    'drafts', count(*) filter (where status = 'draft')
  )
  from public.articles;
$$;

-- Réalisations stats
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

-- AI Memory stats
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

-- Check admin (même traitement : réservé service_role, search_path fixé)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

-- Restriction d'exécution au service_role (le serveur appelle via getSupabaseAdmin)
revoke all on function public.get_articles_stats() from public, anon, authenticated;
revoke all on function public.get_realisations_stats() from public, anon, authenticated;
revoke all on function public.get_memory_stats() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.get_articles_stats() to service_role;
grant execute on function public.get_realisations_stats() to service_role;
grant execute on function public.get_memory_stats() to service_role;
grant execute on function public.is_admin() to service_role;

-- Index trigram pour les recherches admin (ilike %terme%)
create index if not exists idx_articles_title_trgm on public.articles using gin (title gin_trgm_ops);
create index if not exists idx_articles_excerpt_trgm on public.articles using gin (excerpt gin_trgm_ops);
create index if not exists idx_realisations_title_trgm on public.realisations using gin (title gin_trgm_ops);
create index if not exists idx_realisations_search_trgm on public.realisations using gin (
  (title || ' ' || coalesce(short_description, '') || ' ' || coalesce(client_name, '')) gin_trgm_ops
);
create index if not exists idx_ai_memory_key_trgm on public.ai_memory using gin (key gin_trgm_ops);

-- Index de support ai_memory (filtres admin + stats)
create index if not exists idx_ai_memory_session on public.ai_memory (session_id);
create index if not exists idx_ai_memory_type_created on public.ai_memory (memory_type, created_at desc);
