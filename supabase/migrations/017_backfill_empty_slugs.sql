-- Correctif lien-mort vitrine : un slug vide (""/espaces) rend la page publique
-- /journal/$slug (resp. /work/$slug) injoignable — le lien carte pointe alors
-- vers la page liste elle-même (navigation silencieuse + remontée en haut).
-- Les schémas Zod rejettent désormais les slugs vides ; cette migration répare
-- les lignes existantes en régénérant un slug unique depuis le titre.
-- À appliquer via le workflow Supabase habituel (db push / dashboard).

-- Articles : slug vide ou espaces uniquement
update public.articles
set slug = public.generate_slug(title),
    updated_at = now()
where btrim(slug) = '';

-- Réalisations : slug vide ou espaces uniquement
update public.realisations
set slug = public.generate_slug(title),
    updated_at = now()
where btrim(slug) = '';

-- Garde-fou : aucun slug vide ne doit subsister
do $$
begin
  if exists (select 1 from public.articles where btrim(slug) = '') then
    raise exception 'backfill incomplet : articles avec slug vide restants';
  end if;
  if exists (select 1 from public.realisations where btrim(slug) = '') then
    raise exception 'backfill incomplet : realisations avec slug vide restants';
  end if;
end
$$;
