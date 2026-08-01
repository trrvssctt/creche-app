-- ============================================================================
-- PURGE COMPLÈTE DES EMPLOYÉS ET LEURS DONNÉES ASSOCIÉES
-- ============================================================================

BEGIN;

-- 0. Nettoyer les tables qui référencent les users employés
DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE employee_id IS NOT NULL);
DELETE FROM communication_logs WHERE sender_id IN (SELECT id FROM users WHERE employee_id IS NOT NULL);

-- 1. Supprimer les comptes utilisateurs liés aux employés
DELETE FROM users WHERE employee_id IS NOT NULL;

-- 2. Supprimer les données dépendantes des employés
DELETE FROM training_participants WHERE employee_id IN (SELECT id FROM employees);
DELETE FROM performance_reviews WHERE employee_id IN (SELECT id FROM employees);
DELETE FROM employee_documents WHERE employee_id IN (SELECT id FROM employees);
DELETE FROM overtime_requests WHERE employee_id IN (SELECT id FROM employees);
DELETE FROM leaves WHERE employee_id IN (SELECT id FROM employees);
DELETE FROM attendances WHERE employee_id IN (SELECT id FROM employees);
DELETE FROM primes WHERE employee_id IN (SELECT id FROM employees);
DELETE FROM advances WHERE employee_id IN (SELECT id FROM employees);
DELETE FROM contracts WHERE employee_id IN (SELECT id FROM employees);

-- 3. Supprimer les employés
DELETE FROM employees;

COMMIT;

-- Vérification
SELECT 'employees' AS table_name, COUNT(*) AS remaining FROM employees
UNION ALL
SELECT 'users (employee)', COUNT(*) FROM users WHERE employee_id IS NOT NULL
UNION ALL
SELECT 'contracts', COUNT(*) FROM contracts
UNION ALL
SELECT 'attendances', COUNT(*) FROM attendances;
