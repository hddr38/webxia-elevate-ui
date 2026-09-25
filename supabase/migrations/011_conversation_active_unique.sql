-- ============================================
-- MIGRATION 011: ONE ACTIVE CONVERSATION PER SESSION
-- ============================================
-- Idempotence for getOrCreateConversation: at most one 'active'
-- conversation per session_id. Concurrent inserts race on this
-- index (error 23505); the application catches the conflict and
-- re-selects the winner instead of failing.
--
-- No trigger created here: messages_update_conversation_timestamp
-- (AFTER INSERT ON messages, migration 008) already maintains
-- conversations.updated_at transactionally.
--
-- Step 1 (data, non-destructive): close older duplicates left over
-- from before this guard existed (e.g. one active conversation per
-- widget reset). Rows are preserved — only status flips to 'closed',
-- keeping the most recently updated one active per session.

update public.conversations c
set status = 'closed',
  updated_at = now()
where c.status = 'active'
  and exists (
    select 1 from public.conversations newer
    where newer.session_id = c.session_id
      and newer.status = 'active'
      and (
        newer.updated_at > c.updated_at
        or (newer.updated_at = c.updated_at and newer.id > c.id)
      )
  );

-- Step 2 (schema): partial unique guard going forward.
create unique index if not exists uq_conversations_one_active_per_session
  on public.conversations (session_id)
  where status = 'active';

comment on index public.uq_conversations_one_active_per_session is
  'Idempotence guard: a single active conversation per Webi session (see conversation-service getOrCreateConversation)';
