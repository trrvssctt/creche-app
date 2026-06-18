-- Migration: add missing columns to contracts used by the app
-- Adds columns if they do not already exist so this migration is safe to re-run
BEGIN;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS contract_type varchar(100);

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS currency varchar(50);

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;

COMMIT;

-- End migration
