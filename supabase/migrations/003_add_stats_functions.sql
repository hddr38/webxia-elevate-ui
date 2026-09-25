-- Stats helper functions for admin dashboard
-- These replace multiple count queries with single conditional aggregation queries

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
    'sessions', count(distinct session_id)
  )
  from public.ai_memory;
$$;