-- Migration : ajout des colonnes spécifiques crèche sur la table customers
-- À exécuter UNE SEULE FOIS en base de données

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS statut          VARCHAR(20)  DEFAULT 'EN_ATTENTE',
  ADD COLUMN IF NOT EXISTS niveau          VARCHAR(10),
  ADD COLUMN IF NOT EXISTS date_naissance  DATE,
  ADD COLUMN IF NOT EXISTS lieu_naissance  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS regime_financier VARCHAR(30) DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS remise_pct      INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantine         BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS transport_bus   BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS besoin_specifique TEXT,
  ADD COLUMN IF NOT EXISTS parent1_lien    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS parent1_whatsapp VARCHAR(50),
  ADD COLUMN IF NOT EXISTS urgence_nom     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS urgence_tel     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS urgence_lien    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS date_depot      DATE,
  ADD COLUMN IF NOT EXISTS annee_scolaire  VARCHAR(10),
  ADD COLUMN IF NOT EXISTS notes           TEXT;
