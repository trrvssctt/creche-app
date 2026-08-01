-- ============================================================================
-- PURGE COMPLÈTE DES DONNÉES FINANCIÈRES DES ÉLÈVES
-- (échéances, abonnements, créances)
-- ============================================================================
-- Exécuter sur le VPS : psql -U <user> -d <db> -f scripts/purge-finances-eleves.sql

BEGIN;

-- 1. Supprimer toutes les échéances de paiement (créances, factures mensuelles)
DELETE FROM echeances_paiements;

-- 2. Supprimer tous les abonnements élèves (liens élève ↔ service)
DELETE FROM abonnements_eleves;

COMMIT;

-- Vérification
SELECT 'echeances_paiements' AS table_name, COUNT(*) AS remaining FROM echeances_paiements
UNION ALL
SELECT 'abonnements_eleves', COUNT(*) FROM abonnements_eleves;
