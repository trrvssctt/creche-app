-- Migration: Extend HR module with complete tables (leaves, documents, recruitment, training, performance)

-- 0. Ajouter employee_id à la table users pour le plan ENTERPRISE (à faire après création des tables)
-- Cette ligne sera exécutée plus bas après la création de la table employees

-- 1. Créer la table departments d'abord (sans manager_id)
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Créer la table employees avec référence au département
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  first_name varchar(255) NOT NULL,
  last_name varchar(255) NOT NULL,
  email varchar(255),
  phone varchar(100),
  birth_date date,
  gender varchar(10),
  address text,
  city varchar(255),
  country varchar(255) DEFAULT 'Sénégal',
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  position varchar(255),
  manager_id uuid,
  hire_date timestamp,
  status varchar(50) default 'ACTIVE',
  base_salary numeric,
  bank_info jsonb,
  contract_type varchar(100),
  meta jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. Maintenant ajouter la colonne manager_id aux departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES employees(id) ON DELETE SET NULL;

-- 3. Créer la table contracts si elle n'existe pas
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  type varchar(50) NOT NULL DEFAULT 'CDI', -- CDI, CDD, STAGE, FREELANCE
  start_date timestamp NOT NULL,
  end_date timestamp,
  salary numeric NOT NULL,
  status varchar(50) DEFAULT 'ACTIVE', -- ACTIVE, ENDED, SUSPENDED
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 4. Étendre la table contracts avec les champs manquants 
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS trial_period_end timestamp,
ADD COLUMN IF NOT EXISTS document_url text,
ADD COLUMN IF NOT EXISTS signed_date timestamp,
ADD COLUMN IF NOT EXISTS working_hours integer DEFAULT 40;

-- 4. Table leaves (Congés et Absences)
CREATE TABLE IF NOT EXISTS leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  type varchar(50) NOT NULL, -- PAID, SICK, MATERNITY, UNPAID, ANNUAL
  start_date timestamp NOT NULL,
  end_date timestamp NOT NULL,
  days_count integer NOT NULL,
  status varchar(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CANCELLED
  reason text,
  approved_by uuid,
  approved_at timestamp,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 5. Table employee_documents (Coffre-fort numérique)
CREATE TABLE IF NOT EXISTS employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  type varchar(50) NOT NULL, -- ID_CARD, CONTRACT, DIPLOMA, BANK_DETAILS, MEDICAL, OTHER
  category varchar(100),
  file_url text NOT NULL,
  file_size bigint,
  mime_type varchar(255),
  uploaded_at timestamp with time zone DEFAULT now(),
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 6. Table job_offers (Offres d'emploi)
CREATE TABLE IF NOT EXISTS job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  title varchar(255) NOT NULL,
  description text,
  requirements text,
  location varchar(255),
  salary_min numeric,
  salary_max numeric,
  currency varchar(20) DEFAULT 'F CFA',
  employment_type varchar(50), -- CDI, CDD, STAGE, FREELANCE
  department varchar(255),
  status varchar(50) DEFAULT 'OPEN', -- OPEN, CLOSED, PAUSED
  published_at timestamp,
  expires_at timestamp,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 7. Table candidates (Candidats)
CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_offer_id uuid NOT NULL,
  first_name varchar(255) NOT NULL,
  last_name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  phone varchar(100),
  resume_url text,
  cover_letter text,
  status varchar(50) DEFAULT 'NEW', -- NEW, REVIEWED, INTERVIEW, HIRED, REJECTED
  rating integer CHECK (rating >= 1 AND rating <= 5),
  notes text,
  interview_date timestamp,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 8. Table trainings (Formations)
CREATE TABLE IF NOT EXISTS trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  title varchar(255) NOT NULL,
  description text,
  provider varchar(255),
  trainer varchar(255),
  duration_hours integer,
  start_date timestamp,
  end_date timestamp,
  location varchar(255),
  max_participants integer,
  cost numeric DEFAULT 0,
  currency varchar(20) DEFAULT 'F CFA',
  status varchar(50) DEFAULT 'PLANNED', -- PLANNED, ONGOING, COMPLETED, CANCELLED
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 9. Table training_participants (Participants aux formations)
CREATE TABLE IF NOT EXISTS training_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  training_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  status varchar(50) DEFAULT 'ENROLLED', -- ENROLLED, COMPLETED, DROPPED, ABSENT
  completion_date timestamp,
  grade varchar(10), -- A, B, C, D, F
  certificate_url text,
  feedback text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 10. Table performance_reviews (Évaluations de performance)
CREATE TABLE IF NOT EXISTS performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  review_period varchar(50), -- ANNUAL, QUARTERLY, MONTHLY
  period_start date,
  period_end date,
  overall_rating integer CHECK (overall_rating >= 1 AND overall_rating <= 5),
  goals_achievement integer CHECK (goals_achievement >= 1 AND goals_achievement <= 5),
  communication_skills integer CHECK (communication_skills >= 1 AND communication_skills <= 5),
  technical_skills integer CHECK (technical_skills >= 1 AND technical_skills <= 5),
  leadership_skills integer CHECK (leadership_skills >= 1 AND leadership_skills <= 5),
  strengths text,
  areas_for_improvement text,
  goals_next_period text,
  comments text,
  status varchar(50) DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, APPROVED, FINALIZED
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 11. Étendre payrolls pour être conforme aux spécifications
ALTER TABLE payrolls
ADD COLUMN IF NOT EXISTS period_month integer,
ADD COLUMN IF NOT EXISTS period_year integer,
ADD COLUMN IF NOT EXISTS base_salary numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonuses numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS social_charges numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_salary numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS document_url text,
ADD COLUMN IF NOT EXISTS generated_at timestamp DEFAULT now(),
ADD COLUMN IF NOT EXISTS paid_at timestamp;

-- Update existing payrolls status values
UPDATE payrolls SET status = 'DRAFT' WHERE status IS NULL;
ALTER TABLE payrolls ALTER COLUMN status SET DEFAULT 'DRAFT';

-- 12. Table payroll_settings (Paramètres de paie)
CREATE TABLE IF NOT EXISTS payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  social_charge_rate numeric DEFAULT 0.2, -- 20% par défaut
  tax_rate numeric DEFAULT 0.1, -- 10% par défaut
  minimum_wage numeric DEFAULT 60000, -- Salaire minimum sénégalais
  currency varchar(20) DEFAULT 'F CFA',
  payment_day integer DEFAULT 28, -- Jour de paiement dans le mois
  overtime_rate numeric DEFAULT 1.5, -- Taux des heures supplémentaires
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Foreign Key Constraints
-- Ajouter employee_id à la table users (maintenant que employees existe)
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE users
ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE employees
ADD CONSTRAINT fk_employees_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
ADD CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE departments
ADD CONSTRAINT fk_departments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id) REFERENCES employees(id);

ALTER TABLE contracts
ADD CONSTRAINT fk_contracts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
ADD CONSTRAINT fk_contracts_employee FOREIGN KEY (employee_id) REFERENCES employees(id);

ALTER TABLE leaves
ADD CONSTRAINT fk_leaves_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
ADD CONSTRAINT fk_leaves_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
ADD CONSTRAINT fk_leaves_approved_by FOREIGN KEY (approved_by) REFERENCES employees(id);

ALTER TABLE employee_documents
ADD CONSTRAINT fk_employee_documents_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
ADD CONSTRAINT fk_employee_documents_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
ADD CONSTRAINT fk_employee_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES employees(id);

ALTER TABLE job_offers
ADD CONSTRAINT fk_job_offers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
ADD CONSTRAINT fk_job_offers_created_by FOREIGN KEY (created_by) REFERENCES employees(id);

ALTER TABLE candidates
ADD CONSTRAINT fk_candidates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
ADD CONSTRAINT fk_candidates_job_offer FOREIGN KEY (job_offer_id) REFERENCES job_offers(id);

ALTER TABLE trainings
ADD CONSTRAINT fk_trainings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
ADD CONSTRAINT fk_trainings_created_by FOREIGN KEY (created_by) REFERENCES employees(id);

ALTER TABLE training_participants
ADD CONSTRAINT fk_training_participants_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
ADD CONSTRAINT fk_training_participants_training FOREIGN KEY (training_id) REFERENCES trainings(id),
ADD CONSTRAINT fk_training_participants_employee FOREIGN KEY (employee_id) REFERENCES employees(id);

ALTER TABLE performance_reviews
ADD CONSTRAINT fk_performance_reviews_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
ADD CONSTRAINT fk_performance_reviews_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
ADD CONSTRAINT fk_performance_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES employees(id);

ALTER TABLE payroll_settings
ADD CONSTRAINT fk_payroll_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- Indexes pour les performances
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_tenant_name ON departments(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_dept ON employees(tenant_id, department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_leaves_employee_period ON leaves(employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_candidates_job_offer ON candidates(job_offer_id);
CREATE INDEX IF NOT EXISTS idx_training_participants_training ON training_participants(training_id);
CREATE INDEX IF NOT EXISTS idx_training_participants_employee ON training_participants(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_period ON payrolls(tenant_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);

-- Triggers pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all HR tables
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leaves_updated_at BEFORE UPDATE ON leaves FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employee_documents_updated_at BEFORE UPDATE ON employee_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_offers_updated_at BEFORE UPDATE ON job_offers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trainings_updated_at BEFORE UPDATE ON trainings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_participants_updated_at BEFORE UPDATE ON training_participants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_performance_reviews_updated_at BEFORE UPDATE ON performance_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_settings_updated_at BEFORE UPDATE ON payroll_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();