-- Composite indexes for query performance
-- These support the public read queries and admin list queries

-- Articles indexes
create index if not exists idx_articles_category on public.articles using gin (category);
create index if not exists idx_articles_tags on public.articles using gin (tags);
create index if not exists idx_articles_status_published on public.articles(status, published_at desc) where status = 'published';

-- Realisations indexes
create index if not exists idx_realisations_category on public.realisations using gin (category);
create index if not exists idx_realisations_technologies on public.realisations using gin (technologies);
create index if not exists idx_realisations_status_published on public.realisations(status, published_at desc) where status = 'published';
create index if not exists idx_realisations_status_sort on public.realisations(status, sort_order);