-- Migration: Add HR tables (employees, contracts, payrolls, attendances)

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  first_name varchar(255) NOT NULL,
  last_name varchar(255) NOT NULL,
  email varchar(255),
  phone varchar(100),
  dob date,
  hire_date timestamp,
  position varchar(255),
  department varchar(255),
  contract_type varchar(100),
  status varchar(50) default 'ACTIVE',
  meta jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  start_date timestamp,
  end_date timestamp,
  contract_type varchar(100),
  salary numeric,
  currency varchar(20) default 'F CFA',
  status varchar(50) default 'ACTIVE',
  meta jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payrolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  period_start timestamp,
  period_end timestamp,
  gross numeric default 0,
  net numeric default 0,
  taxes numeric default 0,
  deductions numeric default 0,
  status varchar(50) default 'DRAFT',
  meta jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  date date,
  clock_in timestamp,
  clock_out timestamp,
  source varchar(50) default 'manual',
  status varchar(50) default 'PRESENT',
  overtime_minutes integer default 0,
  meta jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_employee ON contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_employee ON payrolls(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendances_employee_date ON attendances(employee_id, date);
