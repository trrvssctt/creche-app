-- Migration: add renewal tracking fields to contracts table
-- Adds maxRenewals, renewalCount, workLocation, previousContractId, isRenewal,
-- renewalReason, renewedAt, renewedBy, createdBy, terminatedBy, terminatedAt,
-- lastModificationReason.
-- NOTE: status is varchar(50) — no enum alteration needed; 'RENEWED' works out of the box.
BEGIN;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS work_location             varchar(255),
  ADD COLUMN IF NOT EXISTS previous_contract_id      uuid REFERENCES contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_renewal                boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_reason            text,
  ADD COLUMN IF NOT EXISTS renewal_count             integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_renewals              integer,
  ADD COLUMN IF NOT EXISTS renewed_at                timestamptz,
  ADD COLUMN IF NOT EXISTS renewed_by                uuid,
  ADD COLUMN IF NOT EXISTS created_by                uuid,
  ADD COLUMN IF NOT EXISTS terminated_by             uuid,
  ADD COLUMN IF NOT EXISTS terminated_at             timestamptz,
  ADD COLUMN IF NOT EXISTS last_modification_reason  text;

COMMIT;
