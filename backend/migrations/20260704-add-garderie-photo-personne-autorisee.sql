-- Nouveaux champs du dossier d'admission / inscription :
--   garderie            : service garderie (maternelle uniquement : CRECHE, PS, MS, GS)
--   personne_autorisee  : personne autorisée à venir chercher l'enfant { nom, telephone, lien }
--   photo_url           : passe en TEXT pour accepter les photos en data-URL compressées
ALTER TABLE eleves ADD COLUMN IF NOT EXISTS garderie BOOLEAN DEFAULT FALSE;
ALTER TABLE eleves ADD COLUMN IF NOT EXISTS personne_autorisee JSONB;
ALTER TABLE eleves ALTER COLUMN photo_url TYPE TEXT;
