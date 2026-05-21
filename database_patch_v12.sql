-- Patch v12 : Gestion des années scolaires clôturées
-- Ajoute la colonne annees_cloturees (tableau JSON) sur la table tenants

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS annees_cloturees JSONB NOT NULL DEFAULT '[]'::jsonb;
