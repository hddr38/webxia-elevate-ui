create index if not exists idx_realisations_sort_order
  on public.realisations(sort_order);

create index if not exists idx_articles_tags
  on public.articles using gin (tags);

create index if not exists idx_realisations_technologies
  on public.realisations using gin (technologies);

create index if not exists idx_articles_status_published
  on public.articles(status, published_at desc);

create index if not exists idx_realisations_status_sort
  on public.realisations(status, sort_order);

create index if not exists idx_articles_created_at
  on public.articles(created_at desc);

create index if not exists idx_realisations_created_at
  on public.realisations(created_at desc);
