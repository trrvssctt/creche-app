-- Migration simplifiée: Créer seulement les tables HR essentielles

-- 1. Créer la table departments
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  manager_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Créer la table employees 
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
  department_id uuid,
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

-- 3. Créer la table contracts
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  type varchar(50) NOT NULL DEFAULT 'CDI',
  start_date timestamp NOT NULL,
  end_date timestamp,
  salary numeric NOT NULL,
  status varchar(50) DEFAULT 'ACTIVE',
  trial_period_end timestamp,
  document_url text,
  signed_date timestamp,
  working_hours integer DEFAULT 40,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 4. Ajouter employee_id à la table users si elle existe
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id uuid;

-- 5. Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_departments_tenant_id ON departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id ON contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_employee_id ON contracts(employee_id);