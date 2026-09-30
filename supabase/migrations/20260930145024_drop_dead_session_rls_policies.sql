-- ============================================================
-- LOT 35 — DROP des 6 policies de session mortes (conversations / messages)
-- ============================================================
-- Constat (audit LOT 35) :
-- Ces policies comparent session_id au claim JWT 'session_id'
-- (current_setting('request.jwt.claims', true)::json->>'session_id').
-- Avec les cles Supabase modernes (sb_publishable_... / sb_secret_...),
-- ce claim n'existe jamais => la lecture est NULL => le predicate est
-- NULL => jamais vrai. Les policies sont mortes : elles ne filtrent
-- rien et ne donnent aucun acces (double effet neutre).
--
-- Isolation reprise server-side (ADR-006) :
--   * toutes les Server Functions de conversations passent par
--     getSupabaseAdmin() (service_role) ;
--   * chaque query porte .eq('session_id', ...) dans le code ;
--   * conversation etrangere -> 404 (jamais de fuite d'existence).
--
-- Conservees sans changement :
--   * conversations_admin_all / messages_admin_all (admin panel)
--   * RLS activee sur public.conversations et public.messages
--   * grants anon (health check de /api/health, health.ts)
--
-- Idempotent : DROP POLICY IF EXISTS uniquement, aucun DROP d'index,
-- aucun DROP de contrainte (uq_conversations_one_active_per_session conservee).
-- ============================================================

BEGIN;

-- CONVERSATIONS
DROP POLICY IF EXISTS "conversations_select_own_session" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_own_session" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_own_session" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete_own_session" ON public.conversations;

-- MESSAGES
DROP POLICY IF EXISTS "messages_select_own_session" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own_session" ON public.messages;

-- La doc de table ne doit plus promettre une isolation "via RLS" qui
-- n'existe plus : l'isolation vit dans les Server Functions.
COMMENT ON TABLE public.conversations IS
  'Anonymous chat conversations for Webi - isolation via service_role server functions (ADR-006)';
COMMENT ON TABLE public.messages IS
  'Chat messages for Webi conversations - isolation via service_role server functions (ADR-006)';

COMMIT;
