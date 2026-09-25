-- LOT 15 — Fix generate_slug volatility : IMMUTABLE -> STABLE
--
-- Raison : public.generate_slug(text) est déclarée IMMUTABLE alors que son
-- corps appelle random() et clock_timestamp() (volatiles). Le label était faux
-- depuis la création (001_initial_schema.sql).
--
-- Verdict d'audit : LOT 13 = LATENT — audit pg_catalog complet : 0 index
-- (pg_indexes), 0 contrainte (pg_constraint), 0 colonne générée/default
-- (pg_attrdef), 0 trigger, 0 vue, 0 fonction référencante, 0 appel TS hors
-- type généré. Aucun rebuild d'index n'est nécessaire.
--
-- Le corps (prosrc) est Inchangé : seul le label provolatile change.
-- search_path='' (posé au LOT 12) est conservé.
--
-- Rollback :
--   ALTER FUNCTION public.generate_slug(text) IMMUTABLE;
--
-- Appliquée via execute_sql (cohérent LOT 8/13, pas apply_migration),
-- baselineée par la suite avec created_by='lot15-baseline'.
BEGIN;
ALTER FUNCTION public.generate_slug(text) STABLE;
COMMIT;
