BEGIN;

-- Détacher les élèves de l'ancienne classe CRECHE
UPDATE eleves SET classe_id = NULL 
WHERE classe_id IN (SELECT id FROM classes WHERE niveau = 'CRECHE');

-- Supprimer les 2 anciennes classes CRECHE (doublon vide + ancienne)
DELETE FROM classes WHERE niveau = 'CRECHE';

-- Vérification
SELECT niveau, COUNT(*) as nb 
FROM eleves WHERE niveau IN ('CRECHE1','CRECHE2','TPS') 
GROUP BY niveau ORDER BY niveau;

COMMIT;
