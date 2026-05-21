-- Migration: Gestion des années scolaires par campagne
-- 2026-05-19

-- 1. Année active du tenant (source de vérité pour toute l'application)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS annee_active VARCHAR(20) DEFAULT NULL;

-- 2. Numéro WhatsApp Business du tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30) DEFAULT NULL;

-- 3. Année scolaire sur les services (les tarifs varient par année)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS annee_scolaire VARCHAR(20) DEFAULT NULL;

-- Index pour filtrage rapide par année
CREATE INDEX IF NOT EXISTS idx_services_annee_scolaire ON services(tenant_id, annee_scolaire);
