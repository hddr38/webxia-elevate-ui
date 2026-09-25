-- LOT 12 — Harden Supabase security advisor WARNs (functions)
-- Advisors ciblés (état avant) :
--   1. anon_security_definer_function_executable (x1) + authenticated_security_definer_function_executable (x1)
--      -> public.rls_auto_enable() SECURITY DEFINER exécutable par anon/authenticated via /rest/v1/rpc
--   2. function_search_path_mutable (x3)
--      -> public.handle_updated_at(), public.generate_slug(text), public.update_conversation_timestamp()
--
-- Hors périmètre LOT 12 (inchangés) : vector/pg_trgm (extension_in_public),
-- auth_leaked_password_protection (dashboard Auth uniquement), policies LOT 5,
-- match_knowledge_chunks, embeddings/HNSW/RAG, schema.sql, docs/.

-- ---------------------------------------------------------------------------
-- A1 — rls_auto_enable()
-- La fonction est celle de l'event trigger `ensure_rls` (ddl_command_end,
-- tags CREATE TABLE / CREATE TABLE AS / SELECT INTO) qui force
-- ENABLE ROW LEVEL SECURITY sur toute nouvelle table de public.
--   - SECURITY DEFINER + owner postgres : CONSERVÉS (l'event trigger doit
--     pouvoir ALTER TABLE quel que soit le rôle qui fait le DDL).
--   - DROP (A3) impossible : fonction utilisée par l'event trigger actif.
--   - INVOKER (A2) éliminé : casserait la finalité de l'event trigger.
--   - REVOKE : owner postgres conserve EXECUTE par propriété (migrations
--     futures intactes) ; service_role conserve son grant explicite.
--   - Idempotent : REVOKE d'un privilège non accordé = no-op.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- B1 — search_path verrouillé sur les 3 fonctions à WARN
-- Corps 100% pg_catalog (et public.conversations déjà qualifié dans
-- update_conversation_timestamp) : aucun changement de prosrc requis,
-- pg_catalog reste résolu même avec search_path=''.
--   - Idempotent : ALTER FUNCTION ... SET ré-applique la même valeur.
-- Rappel : generate_slug est déclarée IMMUTABLE alors qu'elle appelle
-- random() — observation hors périmètre (refacto interdit), non corrigée.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.handle_updated_at() SET search_path = '';
ALTER FUNCTION public.generate_slug(text) SET search_path = '';
ALTER FUNCTION public.update_conversation_timestamp() SET search_path = '';

-- ---------------------------------------------------------------------------
-- C — auth_leaked_password_protection : AUCUN SQL possible (setting dashboard).
-- Action humaine : Dashboard -> Authentication -> Providers (Email)
-- -> section "Password security" -> activer "Protect against leaked passwords"
-- (API HaveIBeenPwned, disponible Pro Plan et supérieur).
-- Doc : https://supabase.com/docs/guides/auth/password-security
-- ---------------------------------------------------------------------------
