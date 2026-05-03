-- Migration: Create payroll_items table for payroll rubrics management
-- Date: 2026-03-03

-- Créer la table payroll_items pour gérer les rubriques de paie
CREATE TABLE IF NOT EXISTS payroll_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name varchar(255) NOT NULL,
    code varchar(50) NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION')),
    category varchar(30) NOT NULL CHECK (category IN (
        'BASE_SALARY', 'ALLOWANCE', 'BONUS', 'OVERTIME', 
        'SOCIAL_CHARGE', 'TAX', 'ADVANCE', 'OTHER'
    )),
    calculation_type varchar(20) NOT NULL DEFAULT 'FIXED' CHECK (calculation_type IN ('FIXED', 'PERCENTAGE', 'FORMULA')),
    default_value decimal(15,2) DEFAULT 0,
    percentage decimal(5,2) DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
    formula text,
    is_active boolean DEFAULT true,
    is_system_item boolean DEFAULT false,
    description text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_payroll_items_tenant ON payroll_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_type ON payroll_items(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_payroll_items_category ON payroll_items(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_payroll_items_active ON payroll_items(tenant_id, is_active);

-- Index unique pour éviter les doublons de code par tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_items_tenant_code ON payroll_items(tenant_id, code);

-- Contrainte pour s'assurer qu'un nom n'est pas dupliqué par tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_items_tenant_name ON payroll_items(tenant_id, name);

-- Commentaires sur les colonnes
COMMENT ON COLUMN payroll_items.type IS 'Type: EARNING (gain) ou DEDUCTION (retenue)';
COMMENT ON COLUMN payroll_items.category IS 'Catégorie de la rubrique (salaire de base, prime, charge sociale, etc.)';
COMMENT ON COLUMN payroll_items.calculation_type IS 'Mode de calcul: FIXED (montant fixe), PERCENTAGE (pourcentage), FORMULA (formule personnalisée)';
COMMENT ON COLUMN payroll_items.default_value IS 'Valeur par défaut en montant fixe';
COMMENT ON COLUMN payroll_items.percentage IS 'Pourcentage si calculation_type=PERCENTAGE';
COMMENT ON COLUMN payroll_items.formula IS 'Formule JavaScript si calculation_type=FORMULA';
COMMENT ON COLUMN payroll_items.is_system_item IS 'Les éléments système ne peuvent pas être supprimés';
COMMENT ON COLUMN payroll_items.sort_order IS 'Ordre d''affichage dans les listes';

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_payroll_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payroll_items_updated_at
    BEFORE UPDATE ON payroll_items
    FOR EACH ROW
    EXECUTE FUNCTION update_payroll_items_updated_at();