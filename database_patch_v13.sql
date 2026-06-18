-- Patch v13 : Dossier numérique de l'élève
-- Crée la table eleve_documents pour stocker les pièces administratives et académiques

CREATE TABLE IF NOT EXISTS eleve_documents (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL,
  eleve_id      UUID          NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  categorie     VARCHAR(20)   NOT NULL CHECK (categorie IN ('ADMINISTRATIF', 'ACADEMIQUE')),
  annee_scolaire VARCHAR(10)  NULL,  -- uniquement pour ACADEMIQUE (ex: "2025-2026")
  type_doc      VARCHAR(50)   NOT NULL DEFAULT 'AUTRE',
  nom           VARCHAR(255)  NOT NULL,
  file_url      TEXT          NOT NULL,
  s3_key        TEXT          NULL,
  mime_type     VARCHAR(100)  NULL,
  file_size     BIGINT        NULL,
  uploaded_by   UUID          NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eleve_documents_eleve    ON eleve_documents (tenant_id, eleve_id);
CREATE INDEX IF NOT EXISTS idx_eleve_documents_annee    ON eleve_documents (tenant_id, eleve_id, annee_scolaire);
CREATE INDEX IF NOT EXISTS idx_eleve_documents_categorie ON eleve_documents (tenant_id, eleve_id, categorie);
