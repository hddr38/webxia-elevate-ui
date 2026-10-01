-- ============================================================
-- LOT 38a — Table leads (capture visiteurs via tool call LLM)
-- ============================================================
-- Contexte : capturer prénom + (email OU téléphone) + résumé de
-- conversation fournis volontairement par un visiteur du chat.
-- Les visiteurs sont anon (pas de auth.users), donc pas de FK auth.
-- RLS : admin SELECT uniquement, INSERT via service_role.
-- ============================================================

-- Partie 1 : ALTER TYPE (autocommit, hors transaction)
-- PG 12+ : la nouvelle valeur n'est pas utilisable dans la même transaction.
-- IF NOT EXISTS rend l'opération idempotente.
ALTER TYPE public.ai_audit_event_type ADD VALUE IF NOT EXISTS 'lead_created';

-- Partie 2 : table + indexes + RLS + grants (transaction)
BEGIN;

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  email text,
  phone text,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_contact_check CHECK (
    email IS NOT NULL OR phone IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_session_id
  ON public.leads(session_id);
CREATE INDEX IF NOT EXISTS idx_leads_email
  ON public.leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone
  ON public.leads(phone) WHERE phone IS NOT NULL;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- SELECT admin uniquement (via EXISTS admin_users)
CREATE POLICY leads_select_admin ON public.leads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Aucune policy INSERT/UPDATE/DELETE pour authenticated/anon :
-- tout passe par service_role (server functions)
-- Les server functions service_role bypassent la RLS de toute façon.

-- Grants : aucun privilège pour anon, aucun pour authenticated hors SELECT
GRANT SELECT ON public.leads TO authenticated;

COMMENT ON TABLE public.leads IS
  'Leads capturés via tool call LLM lors des conversations visiteurs. '
  'Accès admin SELECT uniquement. INSERT via service_role server function.';

COMMIT;