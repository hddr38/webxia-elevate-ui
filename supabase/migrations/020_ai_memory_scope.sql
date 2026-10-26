-- ============================================================
-- 020: AI MEMORY — portée session / global
-- ============================================================
-- Contexte (audit AUDIT-ADMIN-DATA + décision produit MEMORY-GLOBAL) :
--   - ai_memory est aujourd'hui filtrée par session_id uniquement.
--   - Besoin d'une portée "global" : mémoire administrable, disponible
--     pour toutes les sessions Webi.
--   - Les mémoires conversationnelles restent liées à une session.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT IF EXISTS.
-- Aucune suppression de données existantes.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Colonne scope (défaut 'session' pour les lignes existantes)
-- ------------------------------------------------------------
ALTER TABLE public.ai_memory
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'session'
    CHECK (scope IN ('session', 'global'));

-- Les lignes héritent du défaut 'session' (aucune ligne n'est modifiée
-- explicitement, le DEFAULT s'applique au stockage des lignes existantes).

-- ------------------------------------------------------------
-- 2. session_id devient nullable (requis pour 'global', interdit NULL pour 'session')
-- ------------------------------------------------------------
ALTER TABLE public.ai_memory ALTER COLUMN session_id DROP NOT NULL;

-- ------------------------------------------------------------
-- 3. Contraintes d'intégrité par portée
-- ------------------------------------------------------------
-- 'session'  -> session_id NOT NULL, user_id NOT NULL (déjà le cas)
-- 'global'   -> session_id IS NULL,    user_id NOT NULL (déjà le cas)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_memory_scope_session_check'
      AND conrelid = 'public.ai_memory'::regclass
  ) THEN
    ALTER TABLE public.ai_memory
      ADD CONSTRAINT ai_memory_scope_session_check
      CHECK (
        (scope = 'session'  AND session_id IS NOT NULL)
        OR (scope = 'global' AND session_id IS     NULL)
      );
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Index pour la recherche globale
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_memory_scope
  ON public.ai_memory (scope);

CREATE INDEX IF NOT EXISTS idx_ai_memory_scope_global
  ON public.ai_memory (created_at DESC)
  WHERE scope = 'global';

-- Unicité des mémoires globales : une paire (memory_type, key) ne peut
-- exister qu'une seule fois en scope 'global', quel que soit l'admin
-- créateur. Idempotent (CREATE UNIQUE INDEX IF NOT EXISTS).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_memory_global_type_key
  ON public.ai_memory (memory_type, key)
  WHERE scope = 'global';

-- Conserver les index existants (aucun ne est supprimé) :
--   idx_ai_memory_user_session, idx_ai_memory_type,
--   idx_ai_memory_expires, idx_ai_memory_embedding,
--   idx_ai_memory_key_trgm, idx_ai_memory_session,
--   idx_ai_memory_type_created.

-- ------------------------------------------------------------
-- 5. RLS — politique d'accès (aucune ouverture publique)
-- ------------------------------------------------------------
-- Les policies existantes (ai_memory_select/insert/update/delete_own)
-- utilisent auth.uid() = user_id et restent valables pour les
-- mémoires de session : un utilisateur ne voit que ses propres lignes.
--
-- Les mémoires globales portent le user_id de l'admin créateur. Elles
-- sont lues côté serveur exclusivement via getSupabaseAdmin()
-- (service_role, contourne RLS) depuis les Server Functions admin.
-- Aucun SELECT global n'est exposé à anon ou authenticated :
--   - pas de policy USING (true) sur ai_memory ;
--   - pas de grant SELECT public sur la table.
-- Les écritures globales passent uniquement par les Server Functions
-- admin (createMemory / updateMemory), protégées par adminMiddleware.

-- ------------------------------------------------------------
-- 6. Commentaires
-- ------------------------------------------------------------
COMMENT ON COLUMN public.ai_memory.scope IS
  'Portée de la mémoire : "session" (liée à une session visiteur) ou "global" (disponible pour toutes les sessions, administrée).';

COMMENT ON CONSTRAINT ai_memory_scope_session_check ON public.ai_memory IS
  'scope=session exige session_id NOT NULL ; scope=global exige session_id IS NULL.';

COMMIT;

-- ------------------------------------------------------------
-- Vérifications post-conditions (lecture seule, informatif)
-- ------------------------------------------------------------
-- \d public.ai_memory doit afficher :
--   scope text NOT NULL DEFAULT 'session'
--   session_id uuid (nullable)
--   CHECK (scope IN ('session','global'))
--   CHECK ((scope = 'session' AND session_id IS NOT NULL)
--          OR (scope = 'global' AND session_id IS NULL))
-- Index : idx_ai_memory_scope, idx_ai_memory_scope_global
-- RLS policies inchangées (ai_memory_*_own, auth.uid() = user_id)
