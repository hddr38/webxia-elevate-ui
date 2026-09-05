-- Add missing columns that were in schema.sql but never migrated
-- These columns are referenced by server functions and types

-- Articles: add category and reading_minutes
alter table public.articles
  add column if not exists category text[] not null default '{}',
  add column if not exists reading_minutes int not null default 0;

-- Réalisations: add category
alter table public.realisations
  add column if not exists category text[] not null default '{}';
