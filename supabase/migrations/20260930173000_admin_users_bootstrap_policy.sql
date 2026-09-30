-- ============================================================
-- LOT 37 — Bootstrap admin_users insert (whitelist email)
-- ============================================================
-- Contexte : migration 019 a révoqué INSERT sur admin_users pour
-- anon/authenticated. Cette migration rétablit un chemin d'insertion
-- contrôlé pour l'email whitelisté, permettant un reset admin sans
-- SQL Editor. Le whitelist est en dur ; tout changement d'email admin
-- nécessite une nouvelle migration.
-- Idempotente : DROP POLICY IF EXISTS + GRANT (idempotent par nature).
-- ============================================================

BEGIN;

-- 1. Rétablir le privilège INSERT pour authenticated (révoqué par 019)
GRANT INSERT ON public.admin_users TO authenticated;

-- 2. Policy bootstrap (email whitelist + self-insert)
DROP POLICY IF EXISTS "admin_users_insert_bootstrap" ON public.admin_users;
CREATE POLICY "admin_users_insert_bootstrap" ON public.admin_users
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' = 'webxia33@gmail.com'
    AND user_id = auth.uid()
  );

COMMIT;