-- Migration : colonnes scolaires dans la table services
-- Date : 2026-05-01
-- Contexte : adaptation GeStock Pro → Le Toit des Anges (crèche/maternelle/élémentaire)

-- Type d'offre de scolarité
DO $$ BEGIN
  CREATE TYPE public.enum_services_type_offre AS ENUM (
    'INSCRIPTION',
    'MENSUALITE',
    'REINSCRIPTION',
    'BUS',
    'CANTINE',
    'ACTIVITE',
    'AUTRE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ajout des colonnes scolaires
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS type_offre  public.enum_services_type_offre DEFAULT 'MENSUALITE',
  ADD COLUMN IF NOT EXISTS niveaux_cibles jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS duree_mois     integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS inclut_cantine boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS frais_inscription numeric(15,2) DEFAULT 0;

COMMENT ON COLUMN public.services.type_offre IS 'Type d''offre : INSCRIPTION, MENSUALITE, BUS, CANTINE, ACTIVITE…';
COMMENT ON COLUMN public.services.niveaux_cibles IS 'Liste JSON des niveaux scolaires ciblés ex: ["PS","MS","GS"]';
COMMENT ON COLUMN public.services.duree_mois IS 'Durée de l''offre en mois (10 pour une année scolaire standard)';
COMMENT ON COLUMN public.services.inclut_cantine IS 'L''offre inclut-elle la cantine ?';
COMMENT ON COLUMN public.services.frais_inscription IS 'Frais d''inscription uniques (en FCFA)';
