-- Suppression complète des 4 élèves DIANKA et toutes données liées
-- À exécuter dans phpPgAdmin ou psql sur gestionapp_creche_app_local

BEGIN;

-- IDs des 4 élèves DIANKA
-- Oumou DIANKA    : 3355d8f2-699e-4d82-8de7-b21e85e8fff7
-- Diana DIANKA #1 : fd8321c9-58ba-40a0-a232-630add36022c
-- Diana DIANKA #2 : 6fca346a-7b63-4e97-929c-41191d256509
-- Safiatou Dianka  : 1ac22f56-42e8-4929-a41f-7b4cc95b5d9b

-- 1. collection_actions (FK → collection_cases)
DELETE FROM collection_actions
WHERE case_id IN (
  SELECT id FROM collection_cases
  WHERE eleve_id IN (
    '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
    'fd8321c9-58ba-40a0-a232-630add36022c',
    '6fca346a-7b63-4e97-929c-41191d256509',
    '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
  )
);

-- 2. collection_cases
DELETE FROM collection_cases
WHERE eleve_id IN (
  '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
  'fd8321c9-58ba-40a0-a232-630add36022c',
  '6fca346a-7b63-4e97-929c-41191d256509',
  '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
);

-- 3. eleve_documents
DELETE FROM eleve_documents
WHERE eleve_id IN (
  '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
  'fd8321c9-58ba-40a0-a232-630add36022c',
  '6fca346a-7b63-4e97-929c-41191d256509',
  '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
);

-- 4. payment_allocations (FK → echeances_paiements)
DELETE FROM payment_allocations
WHERE echeance_id IN (
  SELECT id FROM echeances_paiements
  WHERE eleve_id IN (
    '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
    'fd8321c9-58ba-40a0-a232-630add36022c',
    '6fca346a-7b63-4e97-929c-41191d256509',
    '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
  )
);

-- 5. refunds
DELETE FROM refunds
WHERE eleve_id IN (
  '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
  'fd8321c9-58ba-40a0-a232-630add36022c',
  '6fca346a-7b63-4e97-929c-41191d256509',
  '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
);

-- 6. credit_notes
DELETE FROM credit_notes
WHERE eleve_id IN (
  '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
  'fd8321c9-58ba-40a0-a232-630add36022c',
  '6fca346a-7b63-4e97-929c-41191d256509',
  '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
);

-- 7. other_revenues
DELETE FROM other_revenues
WHERE eleve_id IN (
  '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
  'fd8321c9-58ba-40a0-a232-630add36022c',
  '6fca346a-7b63-4e97-929c-41191d256509',
  '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
);

-- 8. payments
DELETE FROM payments
WHERE eleve_id IN (
  '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
  'fd8321c9-58ba-40a0-a232-630add36022c',
  '6fca346a-7b63-4e97-929c-41191d256509',
  '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
);

-- 9. echeances_paiements
DELETE FROM echeances_paiements
WHERE eleve_id IN (
  '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
  'fd8321c9-58ba-40a0-a232-630add36022c',
  '6fca346a-7b63-4e97-929c-41191d256509',
  '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
);

-- 10. abonnements_eleves
DELETE FROM abonnements_eleves
WHERE eleve_id IN (
  '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
  'fd8321c9-58ba-40a0-a232-630add36022c',
  '6fca346a-7b63-4e97-929c-41191d256509',
  '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
);

-- 11. bulletins
DELETE FROM bulletins
WHERE eleve_id IN (
  '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
  'fd8321c9-58ba-40a0-a232-630add36022c',
  '6fca346a-7b63-4e97-929c-41191d256509',
  '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
);

-- 12. eleves (les 4 DIANKA)
DELETE FROM eleves
WHERE id IN (
  '3355d8f2-699e-4d82-8de7-b21e85e8fff7',
  'fd8321c9-58ba-40a0-a232-630add36022c',
  '6fca346a-7b63-4e97-929c-41191d256509',
  '1ac22f56-42e8-4929-a41f-7b4cc95b5d9b'
);

-- Vérification
SELECT COUNT(*) AS dianka_restants FROM eleves WHERE LOWER(nom) LIKE '%dianka%';

COMMIT;
