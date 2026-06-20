-- Migration: Ajout de la colonne annee_scolaire_config sur tenants
-- 2026-06-19
-- Permet de stocker le cycle de vie complet de chaque année scolaire
-- (PREPARATION → INSCRIPTIONS_OUVERTES → EN_COURS → CLOTUREE)

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS annee_scolaire_config JSONB DEFAULT '{}';

COMMENT ON COLUMN tenants.annee_scolaire_config IS
  'Cycle de vie des années scolaires. Clé = libellé année (ex: "2025-2026"). '
  'Valeur = { statut, dateCreation, dateOuvertureInscriptions, dateDemarrage, dateCloture }';
