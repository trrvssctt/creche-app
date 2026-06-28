-- Fix: assigner l'année active du tenant aux dossiers avec annee_scolaire NULL
-- Ces dossiers ont été soumis via le portail parent avant que le champ soit obligatoire.
UPDATE eleves e
SET annee_scolaire = t.annee_active
FROM tenants t
WHERE e.tenant_id = t.id
  AND e.annee_scolaire IS NULL
  AND t.annee_active IS NOT NULL;
