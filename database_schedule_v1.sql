-- Migration : Créneaux horaires (emploi du temps par classe)
CREATE TABLE IF NOT EXISTS creneaux_horaires (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  classe_id      UUID         NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enseignant_id  UUID         REFERENCES employees(id) ON DELETE SET NULL,
  jour           INTEGER      NOT NULL CHECK (jour BETWEEN 0 AND 4),
  heure_debut    VARCHAR(5)   NOT NULL,
  heure_fin      VARCHAR(5)   NOT NULL,
  matiere        VARCHAR(100) NOT NULL,
  couleur        VARCHAR(20)  NOT NULL DEFAULT 'blue',
  annee_scolaire VARCHAR(10)  NOT NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creneaux_tenant_classe ON creneaux_horaires (tenant_id, classe_id);
CREATE INDEX IF NOT EXISTS idx_creneaux_enseignant    ON creneaux_horaires (enseignant_id);
