-- Migration pour les déclarations sociales et fiscales
-- Créer les tables nécessaires pour le module de déclaration

-- Table des paramètres de déclaration de l'entreprise
CREATE TABLE IF NOT EXISTS company_declaration_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Informations entreprise
  company_name VARCHAR(255) NOT NULL,
  siret VARCHAR(14),
  naf_code VARCHAR(5),
  legal_form VARCHAR(20) NOT NULL DEFAULT 'SARL' CHECK (legal_form IN ('SARL', 'SA', 'SAS', 'SASU', 'EURL', 'EI', 'SNC', 'SCS', 'OTHER')),
  collective_agreement VARCHAR(255),
  
  -- Adresse
  address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(10),
  country VARCHAR(100) NOT NULL DEFAULT 'Sénégal',
  
  -- Organismes sociaux
  ipres_number VARCHAR(50),
  css_number VARCHAR(50),
  cfce_number VARCHAR(50),
  
  -- Paramètres fiscaux
  tax_number VARCHAR(50),
  vat_number VARCHAR(50),
  tax_regime VARCHAR(20) NOT NULL DEFAULT 'RSI' CHECK (tax_regime IN ('RSI', 'RNI', 'OTHER')),
  
  -- Taux de cotisations (en pourcentage)
  ipres_employee_rate DECIMAL(5,2) NOT NULL DEFAULT 5.6,
  ipres_employer_rate DECIMAL(5,2) NOT NULL DEFAULT 8.4,
  css_employee_rate DECIMAL(5,2) NOT NULL DEFAULT 3.5,
  css_employer_rate DECIMAL(5,2) NOT NULL DEFAULT 7.0,
  cfce_employer_rate DECIMAL(5,2) NOT NULL DEFAULT 7.0,
  accident_work_rate DECIMAL(5,2) NOT NULL DEFAULT 3.0,
  
  -- Paramètres de déclaration
  declaration_day INTEGER NOT NULL DEFAULT 15 CHECK (declaration_day >= 1 AND declaration_day <= 31),
  fiscal_year_start DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Contact responsable
  responsible_name VARCHAR(255),
  responsible_email VARCHAR(255),
  responsible_phone VARCHAR(50),
  
  -- Configuration
  is_active BOOLEAN DEFAULT true,
  last_updated_by UUID REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index et contraintes pour company_declaration_settings
CREATE UNIQUE INDEX IF NOT EXISTS company_declaration_settings_tenant_unique ON company_declaration_settings(tenant_id);
CREATE INDEX IF NOT EXISTS company_declaration_settings_siret_idx ON company_declaration_settings(siret) WHERE siret IS NOT NULL;
CREATE INDEX IF NOT EXISTS company_declaration_settings_tax_number_idx ON company_declaration_settings(tax_number) WHERE tax_number IS NOT NULL;

-- Table des déclarations
CREATE TABLE IF NOT EXISTS declarations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Type et période de déclaration
  declaration_type VARCHAR(30) NOT NULL CHECK (declaration_type IN (
    'IPRES_MONTHLY', 'CSS_MONTHLY', 'CFCE_MONTHLY',
    'VRS_MONTHLY', 'TAX_QUARTERLY', 'TAX_ANNUAL',
    'SOCIAL_ANNUAL', 'DADS', 'OTHER'
  )),
  period VARCHAR(7) NOT NULL, -- Format: YYYY-MM ou YYYY-QX
  fiscal_year INTEGER NOT NULL,
  
  -- Informations sur la déclaration
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Statut et échéances
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY', 'SUBMITTED', 'VALIDATED', 'REJECTED', 'PAID')),
  due_date DATE NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE,
  validated_at TIMESTAMP WITH TIME ZONE,
  
  -- Montants
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  employee_cotisations DECIMAL(15,2) NOT NULL DEFAULT 0,
  employer_cotisations DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  -- Détails techniques
  number_of_employees INTEGER NOT NULL DEFAULT 0,
  total_salary_base DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  -- Références externes
  reference_number VARCHAR(100),
  file_reference VARCHAR(255),
  organisme VARCHAR(20) NOT NULL CHECK (organisme IN ('IPRES', 'CSS', 'CFCE', 'DGI', 'OTHER')),
  
  -- Fichiers et documents (stockés en JSON)
  generated_files JSONB,
  attachments JSONB,
  
  -- Commentaires et notes
  notes TEXT,
  rejection_reason TEXT,
  
  -- Audit
  created_by UUID REFERENCES users(id),
  submitted_by UUID REFERENCES users(id),
  last_modified_by UUID REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index et contraintes pour declarations
CREATE INDEX IF NOT EXISTS declarations_tenant_period_type_idx ON declarations(tenant_id, period, declaration_type);
CREATE INDEX IF NOT EXISTS declarations_status_idx ON declarations(status);
CREATE INDEX IF NOT EXISTS declarations_due_date_idx ON declarations(due_date);
CREATE INDEX IF NOT EXISTS declarations_organisme_idx ON declarations(organisme);
CREATE UNIQUE INDEX IF NOT EXISTS declarations_unique_per_period ON declarations(tenant_id, period, declaration_type);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer le trigger aux deux tables
DROP TRIGGER IF EXISTS update_company_declaration_settings_updated_at ON company_declaration_settings;
CREATE TRIGGER update_company_declaration_settings_updated_at
  BEFORE UPDATE ON company_declaration_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_declarations_updated_at ON declarations;
CREATE TRIGGER update_declarations_updated_at
  BEFORE UPDATE ON declarations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Commenter les tables
COMMENT ON TABLE company_declaration_settings IS 'Paramètres de configuration pour les déclarations sociales et fiscales par entreprise';
COMMENT ON TABLE declarations IS 'Historique et suivi des déclarations sociales et fiscales';

-- Commenter quelques colonnes importantes
COMMENT ON COLUMN company_declaration_settings.ipres_employee_rate IS 'Taux de cotisation IPRES salarié (défaut: 5.6%)';
COMMENT ON COLUMN company_declaration_settings.ipres_employer_rate IS 'Taux de cotisation IPRES employeur (défaut: 8.4%)';
COMMENT ON COLUMN company_declaration_settings.css_employee_rate IS 'Taux de cotisation CSS salarié (défaut: 3.5%)';
COMMENT ON COLUMN company_declaration_settings.css_employer_rate IS 'Taux de cotisation CSS employeur (défaut: 7.0%)';
COMMENT ON COLUMN company_declaration_settings.cfce_employer_rate IS 'Taux de cotisation CFCE employeur uniquement (défaut: 7.0%)';
COMMENT ON COLUMN company_declaration_settings.accident_work_rate IS 'Taux accidents du travail (défaut: 3.0%)';
COMMENT ON COLUMN company_declaration_settings.declaration_day IS 'Jour du mois pour les déclarations (ex: 15 = avant le 15 de chaque mois)';
COMMENT ON COLUMN company_declaration_settings.fiscal_year_start IS 'Début de l''exercice fiscal';

COMMENT ON COLUMN declarations.period IS 'Période de déclaration (ex: 2024-03 ou 2024-Q1)';
COMMENT ON COLUMN declarations.due_date IS 'Date limite de déclaration';
COMMENT ON COLUMN declarations.submitted_at IS 'Date de soumission effective';
COMMENT ON COLUMN declarations.validated_at IS 'Date de validation par l''organisme';
COMMENT ON COLUMN declarations.total_amount IS 'Montant total de la déclaration';
COMMENT ON COLUMN declarations.employee_cotisations IS 'Cotisations salariales';
COMMENT ON COLUMN declarations.employer_cotisations IS 'Cotisations patronales';
COMMENT ON COLUMN declarations.tax_amount IS 'Montant des impôts';
COMMENT ON COLUMN declarations.number_of_employees IS 'Nombre d''employés concernés';
COMMENT ON COLUMN declarations.total_salary_base IS 'Masse salariale de base';
COMMENT ON COLUMN declarations.reference_number IS 'Numéro de référence organisme';
COMMENT ON COLUMN declarations.file_reference IS 'Référence du fichier généré';
COMMENT ON COLUMN declarations.generated_files IS 'Liste des fichiers générés (PDF, XML, etc.)';
COMMENT ON COLUMN declarations.attachments IS 'Documents joints à la déclaration';
COMMENT ON COLUMN declarations.notes IS 'Notes internes sur la déclaration';
COMMENT ON COLUMN declarations.rejection_reason IS 'Motif de rejet si applicable';

-- Afficher les tables créées
SELECT 
  'company_declaration_settings' as table_name, 
  COUNT(*) as row_count 
FROM company_declaration_settings
UNION ALL
SELECT 
  'declarations' as table_name, 
  COUNT(*) as row_count 
FROM declarations;

-- Confirmation
SELECT 'Migration des déclarations sociales et fiscales terminée avec succès!' as status;