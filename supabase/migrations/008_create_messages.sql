-- ============================================
-- MIGRATION 008: CREATE MESSAGES TABLE
-- ============================================
-- Messages belonging to conversations
-- Supports all roles: user, assistant, system, tool

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  tool_calls jsonb,
  tool_call_id text,
  tool_name text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Index for conversation message history (primary access pattern)
create index idx_messages_conversation on public.messages(conversation_id, created_at asc);

-- Index for tool call lookups
create index idx_messages_tool_call on public.messages(tool_call_id) where tool_call_id is not null;

-- RLS: Enable row level security
alter table public.messages enable row level security;

-- Policy: Messages inherit conversation's session isolation
-- Users can only access messages from their own session's conversations
create policy "messages_select_own_session" on public.messages
  for select using (
    conversation_id in (
      select id from public.conversations
      where session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id')
    )
  );

create policy "messages_insert_own_session" on public.messages
  for insert with check (
    conversation_id in (
      select id from public.conversations
      where session_id::text = (current_setting('request.jwt.claims', true)::json->>'session_id')
    )
  );

-- Admin bypass: full access for authenticated admins
create policy "messages_admin_all" on public.messages
  for all using (
    exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

comment on table public.messages is 'Chat messages for Webi conversations - session-isolated via conversation RLS';

-- Trigger to update conversation updated_at on new message
create or replace function public.update_conversation_timestamp()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

create trigger messages_update_conversation_timestamp
  after insert on public.messages
  for each row execute function public.update_conversation_timestamp();