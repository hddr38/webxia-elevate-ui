-- AI Memory stats function
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