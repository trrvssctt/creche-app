-- Migration: Update payroll_settings table with separate employer/employee social charges
-- Date: 2026-03-03

-- Ajouter les nouvelles colonnes
ALTER TABLE payroll_settings 
ADD COLUMN IF NOT EXISTS employer_social_charge_rate DECIMAL(5,2) DEFAULT 18.5,
ADD COLUMN IF NOT EXISTS employee_social_charge_rate DECIMAL(5,2) DEFAULT 8.2;

-- Mettre à jour les valeurs existantes si la colonne social_charge_rate existe
-- Si social_charge_rate était 20% (0.2), on peut estimer:
-- - Employeur: 18.5% (répartition typique au Sénégal)
-- - Salarié: 8.2% (répartition typique au Sénégal)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='payroll_settings' AND column_name='social_charge_rate') THEN
        
        -- Mettre à jour en fonction des valeurs existantes
        UPDATE payroll_settings 
        SET employer_social_charge_rate = CASE 
            WHEN social_charge_rate >= 0.25 THEN 18.5  -- Si >= 25%, utiliser valeurs par défaut
            WHEN social_charge_rate >= 0.15 THEN social_charge_rate * 100 * 0.65  -- 65% pour employeur
            ELSE 18.5
        END,
        employee_social_charge_rate = CASE 
            WHEN social_charge_rate >= 0.25 THEN 8.2   -- Si >= 25%, utiliser valeurs par défaut  
            WHEN social_charge_rate >= 0.15 THEN social_charge_rate * 100 * 0.35  -- 35% pour employé
            ELSE 8.2
        END
        WHERE employer_social_charge_rate IS NULL OR employee_social_charge_rate IS NULL;
        
    END IF;
END $$;

-- Modifier le type de tax_rate pour plus de précision
ALTER TABLE payroll_settings 
ALTER COLUMN tax_rate TYPE DECIMAL(5,2);

-- Supprimer l'ancienne colonne social_charge_rate si elle existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='payroll_settings' AND column_name='social_charge_rate') THEN
        ALTER TABLE payroll_settings DROP COLUMN social_charge_rate;
    END IF;
END $$;

-- Ajouter des commentaires aux colonnes
COMMENT ON COLUMN payroll_settings.employer_social_charge_rate IS 'Taux des charges sociales employeur en pourcentage';
COMMENT ON COLUMN payroll_settings.employee_social_charge_rate IS 'Taux des charges sociales salarié en pourcentage';
COMMENT ON COLUMN payroll_settings.tax_rate IS 'Taux d''imposition en pourcentage';

-- Ajouter des contraintes pour s'assurer que les taux sont raisonnables
ALTER TABLE payroll_settings 
ADD CONSTRAINT check_employer_social_rate CHECK (employer_social_charge_rate >= 0 AND employer_social_charge_rate <= 100),
ADD CONSTRAINT check_employee_social_rate CHECK (employee_social_charge_rate >= 0 AND employee_social_charge_rate <= 100),
ADD CONSTRAINT check_tax_rate CHECK (tax_rate >= 0 AND tax_rate <= 100);