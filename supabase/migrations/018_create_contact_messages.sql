-- ============================================
-- CONTACT MESSAGES (formulaire /contact)
-- ============================================
-- Les briefs sont insérés via Server Function (service role).
-- Lecture / statut / suppression réservées aux admins (admin_users).

create table if not exists public.contact_messages (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  company text check (company is null or char_length(company) <= 160),
  budget text check (budget is null or char_length(budget) <= 200),
  message text not null check (char_length(message) between 10 and 5000),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  status text not null default 'new' check (status in ('new', 'read')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contact_messages is 'Briefs déposés via le formulaire de contact (lecture admin uniquement)';

create index if not exists idx_contact_messages_created on public.contact_messages(created_at desc);
create index if not exists idx_contact_messages_status on public.contact_messages(status);

create trigger set_updated_at_contact_messages
  before update on public.contact_messages
  for each row execute function public.handle_updated_at();

alter table public.contact_messages enable row level security;

-- Aucune policy publique : l'insert passe par la Server Function (service role,
-- rate-limitée + validée). Lecture / modification / suppression : admins seuls.
create policy "contact_messages_select_admin" on public.contact_messages
  for select using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

create policy "contact_messages_update_admin" on public.contact_messages
  for update using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

create policy "contact_messages_delete_admin" on public.contact_messages
  for delete using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );
