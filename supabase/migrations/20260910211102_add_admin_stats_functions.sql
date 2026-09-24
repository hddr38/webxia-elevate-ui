-- Stats helper functions for admin dashboard (missing in production)
create or replace function public.get_articles_stats()
returns json language sql stable as $$
  select json_build_object(
    'total', count(*),
    'published', count(*) filter (where status = 'published'),
    'drafts', count(*) filter (where status = 'draft')
  )
  from public.articles;
$$;

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
