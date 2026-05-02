-- Migration pour les tables des avances et primes
-- Date: 2026-03-04
-- Description: Ajout des fonctionnalités d'avances sur salaire et primes exceptionnelles

-- Extension UUID (au cas où elle ne serait pas déjà activée)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des avances sur salaire
CREATE TABLE IF NOT EXISTS advances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    months INTEGER NOT NULL DEFAULT 1 CHECK (months >= 1 AND months <= 12),
    reason TEXT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'F CFA',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by UUID,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    start_date DATE,
    end_date DATE,
    remaining_amount DECIMAL(15, 2) DEFAULT 0,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes de clés étrangères
    CONSTRAINT fk_advances_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_advances_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_advances_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Table des primes exceptionnelles
CREATE TABLE IF NOT EXISTS primes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'PERFORMANCE' CHECK (type IN ('PERFORMANCE', 'EXCEPTIONAL', 'ANNUAL_BONUS', 'PROJECT_BONUS', 'OTHER')),
    currency VARCHAR(10) NOT NULL DEFAULT 'F CFA',
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by UUID,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    payroll_month VARCHAR(7), -- Format YYYY-MM
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMP,
    category VARCHAR(100),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes de clés étrangères
    CONSTRAINT fk_primes_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_primes_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_primes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_advances_employee_id ON advances(employee_id);
CREATE INDEX IF NOT EXISTS idx_advances_tenant_id ON advances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_advances_status ON advances(status);
CREATE INDEX IF NOT EXISTS idx_advances_created_at ON advances(created_at);

CREATE INDEX IF NOT EXISTS idx_primes_employee_id ON primes(employee_id);
CREATE INDEX IF NOT EXISTS idx_primes_tenant_id ON primes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_primes_status ON primes(status);
CREATE INDEX IF NOT EXISTS idx_primes_type ON primes(type);
CREATE INDEX IF NOT EXISTS idx_primes_payroll_month ON primes(payroll_month);
CREATE INDEX IF NOT EXISTS idx_primes_created_at ON primes(created_at);

-- Triggers pour mettre à jour les timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour advances
DROP TRIGGER IF EXISTS trigger_advances_updated_at ON advances;
CREATE TRIGGER trigger_advances_updated_at
    BEFORE UPDATE ON advances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour primes
DROP TRIGGER IF EXISTS trigger_primes_updated_at ON primes;
CREATE TRIGGER trigger_primes_updated_at
    BEFORE UPDATE ON primes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Commentaires pour documentation
COMMENT ON TABLE advances IS 'Table des avances sur salaire accordées aux employés';
COMMENT ON COLUMN advances.months IS 'Nombre de mois pour lesquels l''avance est accordée';
COMMENT ON COLUMN advances.remaining_amount IS 'Montant restant à déduire des salaires futurs';

COMMENT ON TABLE primes IS 'Table des primes exceptionnelles accordées aux employés';
COMMENT ON COLUMN primes.payroll_month IS 'Mois de paie où cette prime sera incluse (format YYYY-MM)';
COMMENT ON COLUMN primes.category IS 'Catégorie de la prime pour les rapports et classifications';

-- Quelques données par défaut pour tester (optionnel)
-- Ces données ne seront créées que si aucune donnée n'existe dans les tables

-- Noter: Ces INSERT ne sont que des exemples et nécessitent des IDs réels d'employés et de tenants
-- INSERT INTO advances (employee_id, amount, months, reason, tenant_id) 
-- SELECT e.id, 150000.00, 1, 'Avance pour frais médicaux', e.tenant_id 
-- FROM employees e 
-- WHERE e.first_name = 'Test' 
-- AND NOT EXISTS (SELECT 1 FROM advances WHERE employee_id = e.id)
-- LIMIT 1;

COMMIT;