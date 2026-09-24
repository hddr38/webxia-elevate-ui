-- ============================================================
-- LOT 5 — 019: HARDEN admin_users INSERT + knowledge RLS
-- ============================================================
-- Contexte (audit LOT 4) :
-- 1. admin_users_insert_self permettait l'auto-élévation admin.
-- 2. knowledge_*_select_public USING (true) exposait la KB.
-- RAG = match_knowledge_chunks (service_role) ; admin = getSupabaseAdmin().
-- Aucun changement embedding / RPC / pipeline RAG.
-- Idempotent : DROP POLICY IF EXISTS + REVOKE.
-- ============================================================

BEGIN;

-- 1. ADMIN — supprimer l'auto-insert public
DROP POLICY IF EXISTS "admin_users_insert_self" ON public.admin_users;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.admin_users
  FROM anon, authenticated;

-- SELECT self conservé (admin_users_select_self inchangée).

-- 2. KNOWLEDGE — supprimer la lecture publique
DROP POLICY IF EXISTS "knowledge_documents_select_public" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_chunks_select_public" ON public.knowledge_chunks;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON public.knowledge_documents
  FROM anon, authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON public.knowledge_chunks
  FROM anon, authenticated;

-- service_role et policies knowledge_*_admin_all : inchangés.

COMMIT;
