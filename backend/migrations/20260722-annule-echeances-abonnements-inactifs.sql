-- Annuler toutes les échéances EN_ATTENTE / EN_RETARD dont l'abonnement est déjà désactivé
UPDATE echeances_paiements ep
SET statut = 'ANNULE'
FROM abonnements_eleves ae
WHERE ep.abonnement_id = ae.id
  AND ae.is_active = false
  AND ep.statut IN ('EN_ATTENTE', 'EN_RETARD');
