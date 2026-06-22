-- Migration: Ajout de la colonne eleve_ids sur users
-- 2026-06-21
-- Permet de lier un compte utilisateur PARENT/TUTEUR à ses enfants inscrits.
-- Un parent peut avoir plusieurs enfants (fratrie).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS eleve_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN users.eleve_ids IS
  'Liste des IDs d''élèves dont cet utilisateur est le parent/tuteur. '
  'Utilisé exclusivement pour les comptes avec rôle PARENT ou TUTEUR.';
