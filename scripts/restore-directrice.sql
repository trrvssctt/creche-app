-- Restaurer le compte directrice supprimé par le purge employés
-- À exécuter sur le VPS : psql -U <user> -d <db> -f restore-directrice.sql

-- Récupérer le tenant_id (il n'y en a qu'un seul normalement)
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

  -- Vérifier si le user existe déjà
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'directrice@toit-des-anges.sn') THEN
    INSERT INTO users (id, tenant_id, email, password, name, roles, role, is_active, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      v_tenant_id,
      'directrice@toit-des-anges.sn',
      '$2b$12$l9wCSwZJ/FLflzH.CEfoSOokQYyvs0ZtSl4UYgT1qGaExPZozTgYq',
      'Directrice',
      '{ADMIN,DIRECTEUR}',
      'ADMIN',
      true,
      NOW(),
      NOW()
    );
    RAISE NOTICE 'Compte directrice créé avec succès.';
  ELSE
    -- Réinitialiser le mot de passe si le compte existe
    UPDATE users
    SET password = '$2b$12$l9wCSwZJ/FLflzH.CEfoSOokQYyvs0ZtSl4UYgT1qGaExPZozTgYq',
        is_active = true,
        employee_id = NULL
    WHERE email = 'directrice@toit-des-anges.sn';
    RAISE NOTICE 'Mot de passe directrice réinitialisé.';
  END IF;
END $$;
