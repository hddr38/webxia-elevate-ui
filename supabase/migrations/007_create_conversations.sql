-- ============================================
-- MIGRATION 007: CREATE CONVERSATIONS TABLE
-- ============================================
-- Anonymous conversations for Webi chatbot
-- No authentication required - session-based isolation

create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null,
  status text not null default 'active' check (status in ('active','archived','closed')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for session-based lookups (primary access pattern)
create index idx_conversations_session on public.conversations(session_id, created_at desc);

-- Index for status filtering
create index idx_conversations_status on public.conversations(status);

-- RLS: Enable row level security
alter table public.conversations enable row level security;

-- Policy: Users can only access their own session's conversations
-- Since visitors are anonymous, we use session_id from cookie/localStorage
-- The server function will validate session ownership before allowing access
create policy "conversations_select_own_session" on public.conversations
  for select using (session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id'));

create policy "conversations_insert_own_session" on public.conversations
  for insert with check (session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id'));

create policy "conversations_update_own_session" on public.conversations
  for update using (session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id'))
  with check (session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id'));

create policy "conversations_delete_own_session" on public.conversations
  for delete using (session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id'));

-- Admin bypass: full access for authenticated admins
create policy "conversations_admin_all" on public.conversations
  for all using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

comment on table public.conversations is 'Anonymous chat conversations for Webi - session-isolated via RLS';