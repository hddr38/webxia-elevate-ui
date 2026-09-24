-- ============================================================
-- LOT 5 — 019: HARDEN admin_users INSERT + knowledge RLS
-- ============================================================
--
-- Contexte (audit LOT 4, confirmé en production) :
-- 1. admin_users_insert_self permettait à tout utilisateur
--    authentifié de s'inscrire comme admin (role DEFAULT 'admin').
-- 2. knowledge_documents_select_public USING (true) exposait
--    toute la Knowledge Base en lecture anon/authenticated.
--    Le retrieval RAG passe déjà par match_knowledge_chunks
--    (service_role) et l'admin par getSupabaseAdmin().
--
-- Interdits explicites de ce lot :
--   - aucun toucher aux embeddings / dimensions / HNSW / 012
--   - aucun toucher au RPC match_knowledge_chunks
--   - aucun toucher au pipeline RAG
--   - aucun workflow status/published
--
-- Idempotent : DROP POLICY IF EXISTS + REVOKE (no-op si déjà fait).
-- Réversible conceptuellement : récréer les policies 001/009.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. ADMIN — supprimer l'auto-insert public
-- ------------------------------------------------------------
-- L'admin initial / existant n'est pas affecté :
--   - getSessionUser / assertRagAccess / is_admin() utilisent
--     getSupabaseAdmin() (service_role, bypass RLS) ;
--   - aucune ligne n'est supprimée.
-- Création d'un nouvel admin : uniquement via service_role
-- (SQL Editor ou script contrôlé), jamais via le client anon.

DROP POLICY IF EXISTS "admin_users_insert_self" ON public.admin_users;

-- Defense in depth : le client PostgREST (anon/authenticated)
-- n'a plus besoin d'écrire admin_users (aucun chemin applicatif
-- ne l'utilise hors service_role).

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.admin_users
  FROM anon, authenticated;

-- SELECT self conservé (policy admin_users_select_self inchangée) :
-- lecture limitée à sa propre ligne, sans privilège d'élévation.

-- ------------------------------------------------------------
-- 2. KNOWLEDGE — supprimer la lecture publique
-- ------------------------------------------------------------
-- Policies SELECT publiques créées en 009. Les policies
-- knowledge_*_admin_all sont conservées (accès admin JWT).

DROP POLICY IF EXISTS "knowledge_documents_select_public" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_chunks_select_public" ON public.knowledge_chunks;

-- Grants : anon et authenticated n'accèdent plus aux tables
-- en dehors des éventuels chemins admin (couverts par admin_all
-- + service_role). Le RPC match_knowledge_chunks n'utilise pas
-- ces grants (SECURITY DEFINER, service_role only).

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON public.knowledge_documents
  FROM anon, authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON public.knowledge_chunks
  FROM anon, authenticated;

-- service_role : inchangé (non révoqué). Fonctions SECURITY
-- DEFINER (match_knowledge_chunks, is_admin) : inchangées.

COMMIT;

-- ------------------------------------------------------------
-- Vérifications post-conditions (lecture seule, informatif)
-- ------------------------------------------------------------
-- Policies attendues admin_users :
--   admin_users_select_self, admin_users_update_self, admin_users_delete_self
--   (sans insert_self)
-- Policies attendues knowledge :
--   knowledge_documents_admin_all, knowledge_chunks_admin_all
--   (sans select_public)
