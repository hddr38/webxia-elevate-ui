-- Fix author_id foreign key: CASCADE -> SET NULL
-- Prevents data loss when auth user is deleted

-- Articles table
alter table public.articles
  drop constraint if exists articles_author_id_fkey,
  add constraint articles_author_id_fkey
    foreign key (author_id) references auth.users(id) on delete set null;

-- Realisations table
alter table public.realisations
  drop constraint if exists realisations_author_id_fkey,
  add constraint realisations_author_id_fkey
    foreign key (author_id) references auth.users(id) on delete set null;

-- Make author_id nullable since it can now be null
alter table public.articles alter column author_id drop not null;
alter table public.realisations alter column author_id drop not null;