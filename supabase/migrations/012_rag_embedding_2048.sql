-- ============================================================
-- MIGRATION 012 — RAG EMBEDDING 2048 + HNSW HALFVEC
-- ============================================================
--
-- Modele valide :
-- nvidia/nemotron-3-embed-1b
--
-- Dimension native :
-- 2048
--
-- Stockage :
-- vector(2048) (precision complete, float32)
--
-- Index :
-- HNSW sur expression halfvec(2048)
--
-- Pourquoi :
-- HNSW sur type vector est limite a 2000 dimensions dans pgvector,
-- donc un vector(2048) ne peut pas porter d'index HNSW natif.
-- halfvec supporte l'indexation HNSW jusqu'a 4000 dimensions :
-- le stockage reste en vector(2048) intact, seul l'index utilise
-- la representation halfvec. (IVFFlat n'a pas cette limite, mais
-- HNSW est retenu ici : pas de donnees d'entrainement requises,
-- efficace des les petites tables, meilleur rappel/latence.)
-- La fonction match_knowledge_chunks (013) interroge en espace
-- halfvec pour que le planificateur utilise ces index.
--
-- Les donnees sont actuellement vides.
--
-- STATUS: CREATED — NOT APPLIED (apply manually via Supabase SQL Editor).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Supprimer les anciens index vectoriels 1536
-- ------------------------------------------------------------

DROP INDEX IF EXISTS public.idx_ai_memory_embedding;
DROP INDEX IF EXISTS public.idx_knowledge_chunks_embedding;

-- ------------------------------------------------------------
-- 2. Passer les colonnes a vector(2048)
-- ------------------------------------------------------------

ALTER TABLE public.ai_memory
  ALTER COLUMN embedding TYPE vector(2048);

ALTER TABLE public.knowledge_chunks
  ALTER COLUMN embedding TYPE vector(2048);

-- ------------------------------------------------------------
-- 3. Creer les index HNSW sur halfvec(2048)
--    (parametres HNSW par defaut : m=16, ef_construction=64)
-- ------------------------------------------------------------

CREATE INDEX idx_ai_memory_embedding
  ON public.ai_memory
  USING hnsw (
    (embedding::halfvec(2048))
    halfvec_cosine_ops
  );

CREATE INDEX idx_knowledge_chunks_embedding
  ON public.knowledge_chunks
  USING hnsw (
    (embedding::halfvec(2048))
    halfvec_cosine_ops
  );

-- ------------------------------------------------------------
-- 4. Documenter le contrat
-- ------------------------------------------------------------

COMMENT ON COLUMN public.ai_memory.embedding IS
  'Embedding nvidia/nemotron-3-embed-1b, 2048 dims natifs. Index HNSW via halfvec(2048). Single source of truth: EMBEDDING_CONFIG.';

COMMENT ON COLUMN public.knowledge_chunks.embedding IS
  'Embedding nvidia/nemotron-3-embed-1b, 2048 dims natifs. Index HNSW via halfvec(2048). Single source of truth: EMBEDDING_CONFIG.';

COMMIT;
