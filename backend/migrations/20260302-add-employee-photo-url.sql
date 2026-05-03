-- Migration: add photoUrl column to employees table
-- Adds photoUrl column if it does not already exist so this migration is safe to re-run
BEGIN;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS photo_url varchar(500);

COMMIT;

-- End migration