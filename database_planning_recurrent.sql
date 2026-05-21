-- Migration : Planning récurrent (période scolaire + exceptions par date)

-- Table de configuration de la période scolaire
CREATE TABLE IF NOT EXISTS planning_config (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  annee_scolaire VARCHAR(10)  NOT NULL,
  date_debut     DATE         NOT NULL,
  date_fin       DATE         NOT NULL,
  jours_repos    JSONB        NOT NULL DEFAULT '[]',
  created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, annee_scolaire)
);

CREATE INDEX IF NOT EXISTS idx_planning_config_tenant ON planning_config (tenant_id, annee_scolaire);

-- Table des exceptions au planning (annulation ou modification d'un créneau pour une date précise)
CREATE TABLE IF NOT EXISTS planning_exceptions (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creneau_id            UUID         NOT NULL REFERENCES creneaux_horaires(id) ON DELETE CASCADE,
  date_exception        DATE         NOT NULL,
  type_exception        VARCHAR(20)  NOT NULL DEFAULT 'ANNULE' CHECK (type_exception IN ('ANNULE', 'MODIFIE')),
  matiere_override      VARCHAR(100),
  heure_debut_override  VARCHAR(5),
  heure_fin_override    VARCHAR(5),
  note                  VARCHAR(255),
  created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
  UNIQUE(creneau_id, date_exception)
);

CREATE INDEX IF NOT EXISTS idx_planning_exceptions_tenant ON planning_exceptions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_planning_exceptions_date   ON planning_exceptions (date_exception);
