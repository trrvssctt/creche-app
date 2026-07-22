-- Ajouter le jour d'échéance configurable aux abonnements
ALTER TABLE abonnements_eleves ADD COLUMN IF NOT EXISTS jour_echeance INTEGER;
