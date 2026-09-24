-- Add columns needed for public site display
alter table if exists public.articles
  add column if not exists category text[] not null default '{}',
  add column if not exists reading_minutes int not null default 5;

alter table if exists public.realisations
  add column if not exists category text[] not null default '{}';

-- GIN index for category array filtering
create index if not exists idx_articles_category on public.articles using gin (category);
create index if not exists idx_realisations_category on public.realisations using gin (category);
