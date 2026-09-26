-- Migration: Redevance contractuelle sur chiffre d'affaires (Revenue Share)
-- Date: 2026-09-09
--
-- Contrat éditeur : l'exploitant perçoit un pourcentage du chiffre d'affaires
-- de l'établissement. Le taux est réglable entre 0,50 % et 1,00 % et n'est
-- modifiable que par un SUPER_ADMIN.

CREATE TABLE IF NOT EXISTS revenue_share_settings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  -- Taux exprimé en fraction : 0.005 = 0,50 %, 0.01 = 1,00 %
  commission_rate    NUMERIC(6, 5) NOT NULL DEFAULT 0.005,
  min_rate           NUMERIC(6, 5) NOT NULL DEFAULT 0.005,
  max_rate           NUMERIC(6, 5) NOT NULL DEFAULT 0.01,
  -- Base de calcul du CA : CA_COMPTABLE | CA_ENCAISSE | CA_ENGAGEMENT
  calculation_basis  VARCHAR(20) NOT NULL DEFAULT 'CA_COMPTABLE',
  -- Inclure les recettes diverses (other_revenues) dans l'assiette
  include_other_revenues BOOLEAN NOT NULL DEFAULT true,
  contract_reference VARCHAR(100),
  effective_from     DATE,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT revenue_share_rate_bounds CHECK (commission_rate >= min_rate AND commission_rate <= max_rate),
  CONSTRAINT revenue_share_hard_bounds CHECK (commission_rate >= 0.005 AND commission_rate <= 0.01),
  CONSTRAINT revenue_share_basis_valid CHECK (calculation_basis IN ('CA_COMPTABLE', 'CA_ENCAISSE', 'CA_ENGAGEMENT'))
);

-- Historique des changements de taux (traçabilité contractuelle)
CREATE TABLE IF NOT EXISTS revenue_share_rate_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  previous_rate     NUMERIC(6, 5),
  new_rate          NUMERIC(6, 5) NOT NULL,
  previous_basis    VARCHAR(20),
  new_basis         VARCHAR(20),
  changed_by        UUID,
  changed_by_name   VARCHAR(255),
  reason            TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rs_settings_tenant ON revenue_share_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rs_history_tenant  ON revenue_share_rate_history(tenant_id, created_at DESC);

-- Initialisation : chaque tenant existant démarre au taux contractuel plancher (0,50 %)
INSERT INTO revenue_share_settings (tenant_id, commission_rate, effective_from)
SELECT t.id, 0.005, CURRENT_DATE
FROM tenants t
ON CONFLICT (tenant_id) DO NOTHING;
