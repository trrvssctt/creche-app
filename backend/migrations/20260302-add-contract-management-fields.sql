-- Migration: add contract management fields
-- Adds termination and suspension fields to contracts table
BEGIN;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS termination_date date,
  ADD COLUMN IF NOT EXISTS termination_reason text,
  ADD COLUMN IF NOT EXISTS suspension_date date,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

COMMIT;
