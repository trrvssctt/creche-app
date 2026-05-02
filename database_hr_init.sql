-- HR TABLES INITIALIZATION
-- This script creates all necessary tables for the HR module

-- 1. Departments table
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Employees table  
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(100),
    birth_date DATE,
    gender VARCHAR(1) CHECK (gender IN ('M', 'F', 'O')),
    address TEXT,
    city VARCHAR(255),
    country VARCHAR(255) DEFAULT 'Sénégal',
    department_id UUID REFERENCES departments(id),
    position VARCHAR(255),
    manager_id UUID REFERENCES employees(id),
    hire_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    base_salary NUMERIC(15,2),
    bank_info JSONB,
    contract_type VARCHAR(50), -- for backward compatibility
    photo_url VARCHAR(500),
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    contract_type VARCHAR(50) DEFAULT 'CDI' CHECK (contract_type IN ('CDI', 'CDD', 'STAGE', 'FREELANCE')),
    start_date DATE,
    end_date DATE,
    salary NUMERIC(15,2),
    working_hours INTEGER DEFAULT 40,
    currency VARCHAR(20) DEFAULT 'F CFA',
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'TERMINATED', 'SUSPENDED')),
    termination_date DATE,
    termination_reason TEXT,
    suspension_date DATE,
    suspension_reason TEXT,
    trial_period_end DATE,
    document_url TEXT,
    signed_date DATE,
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Leaves table
CREATE TABLE IF NOT EXISTS leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(20) DEFAULT 'PAID' CHECK (type IN ('PAID', 'SICK', 'MATERNITY', 'UNPAID', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INTEGER,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reason TEXT,
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    document_url VARCHAR(500),
    document_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Payrolls table
CREATE TABLE IF NOT EXISTS payrolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
    period_year INTEGER NOT NULL,
    base_salary NUMERIC(15,2) DEFAULT 0,
    bonuses NUMERIC(15,2) DEFAULT 0,
    deductions NUMERIC(15,2) DEFAULT 0,
    gross_salary NUMERIC(15,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    social_contributions NUMERIC(15,2) DEFAULT 0,
    net_salary NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VALIDATED', 'PAID')),
    document_url VARCHAR(500),
    paid_at TIMESTAMP WITH TIME ZONE,
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Attendances table
CREATE TABLE IF NOT EXISTS attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    break_duration INTEGER DEFAULT 0, -- in minutes
    total_hours NUMERIC(4,2),
    status VARCHAR(20) DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE', 'HALF_DAY')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Employee Documents table
CREATE TABLE IF NOT EXISTS employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    category VARCHAR(50) CHECK (category IN ('ID', 'CONTRACT', 'DIPLOMA', 'PAYSLIP', 'MEDICAL', 'OTHER')),
    name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_employee ON contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

CREATE INDEX IF NOT EXISTS idx_leaves_tenant ON leaves(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leaves_employee ON leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);
CREATE INDEX IF NOT EXISTS idx_leaves_dates ON leaves(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_payrolls_tenant ON payrolls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_employee ON payrolls(employee_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_period ON payrolls(period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_attendances_tenant ON attendances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendances_employee ON attendances(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(date);

CREATE INDEX IF NOT EXISTS idx_departments_tenant ON departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_tenant ON employee_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_tenant_email ON employees(tenant_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_tenant_name ON departments(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_employee_date ON attendances(employee_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payrolls_employee_period ON payrolls(employee_id, period_year, period_month);