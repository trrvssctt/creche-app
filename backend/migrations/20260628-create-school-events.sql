CREATE TABLE IF NOT EXISTS school_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  titre         VARCHAR(255) NOT NULL,
  description   TEXT,
  type_evenement VARCHAR(50) DEFAULT 'INFO',
  statut        VARCHAR(20) DEFAULT 'PUBLIE',
  date_debut    DATE NOT NULL,
  date_fin      DATE,
  heure_debut   VARCHAR(10),
  heure_fin     VARCHAR(10),
  lieu          VARCHAR(255),
  niveaux_cibles TEXT DEFAULT 'TOUS',
  diffuse       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_events_tenant ON school_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_school_events_statut  ON school_events(statut);
