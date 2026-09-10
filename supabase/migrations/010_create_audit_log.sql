-- ============================================
-- MIGRATION 010: CREATE AI AUDIT LOG TABLE
-- ============================================
-- Security audit logging for Webi agent

create type ai_audit_event_type as enum (
  'auth_failure',
  'rate_limit_exceeded',
  'unauthorized_tool_access',
  'prompt_injection_detected',
  'validation_failure',
  'provider_error',
  'tool_execution_failure',
  'memory_access_violation',
  'rag_access_violation',
  'permission_denied',
  'oversized_payload',
  'context_too_large',
  'max_steps_exceeded',
  'suspicious_activity'
);

create type ai_audit_severity as enum ('low', 'medium', 'high', 'critical');

create table public.ai_audit_log (
  id uuid primary key default uuid_generate_v4(),
  event_type ai_audit_event_type not null,
  severity ai_audit_severity not null default 'medium',
  user_id uuid references auth.users(id) on delete set null,
  session_id uuid,
  conversation_id uuid,
  request_id uuid,
  ip_address inet,
  user_agent text,
  event_data jsonb not null default '{}',
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_ai_audit_log_event_type on public.ai_audit_log(event_type);
create index idx_ai_audit_log_session on public.ai_audit_log(session_id);
create index idx_ai_audit_log_conversation on public.ai_audit_log(conversation_id);
create index idx_ai_audit_log_created on public.ai_audit_log(created_at desc);
create index idx_ai_audit_log_severity on public.ai_audit_log(severity);
create index idx_ai_audit_log_user on public.ai_audit_log(user_id);

-- RLS: Only admins can read audit logs
alter table public.ai_audit_log enable row level security;

create policy "ai_audit_log_admin_read" on public.ai_audit_log
  for select using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- Admin can insert audit logs (for server-side logging)
create policy "ai_audit_log_admin_insert" on public.ai_audit_log
  for insert with check (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

comment on table public.ai_audit_log is 'Security audit log for Webi agent - tracks security events, auth failures, rate limits, etc.';