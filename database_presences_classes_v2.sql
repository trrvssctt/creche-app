-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : Présences élèves + intervenants par matière dans les classes
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Colonne enseignants_matiere dans classes (liste JSONB des intervenants)
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS enseignants_matiere JSONB NOT NULL DEFAULT '[]';

-- 2. Table des présences / absences élèves
CREATE TABLE IF NOT EXISTS presences (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  classe_id        UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  eleve_id         UUID        NOT NULL REFERENCES eleves(id)  ON DELETE CASCADE,
  enseignant_id    UUID        REFERENCES employees(id)        ON DELETE SET NULL,
  date             DATE        NOT NULL,
  statut           VARCHAR(10) NOT NULL DEFAULT 'PRESENT'
                              CHECK (statut IN ('PRESENT', 'ABSENT', 'RETARD')),
  motif            TEXT,
  created_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP   NOT NULL DEFAULT NOW(),

  -- Une seule entrée par (tenant, classe, élève, jour)
  CONSTRAINT presences_unique_day UNIQUE (tenant_id, classe_id, eleve_id, date)
);

-- Index pour les requêtes courantes
CREATE INDEX IF NOT EXISTS idx_presences_tenant_classe_date
  ON presences (tenant_id, classe_id, date);

CREATE INDEX IF NOT EXISTS idx_presences_eleve
  ON presences (eleve_id);

CREATE INDEX IF NOT EXISTS idx_presences_enseignant
  ON presences (enseignant_id);
