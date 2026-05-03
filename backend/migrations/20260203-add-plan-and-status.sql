-- Add missing columns and defaults to align schema with current code
-- Adjust table names if your DB uses a different naming convention
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan VARCHAR(128);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ACTIVE';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ACTIVE';
-- Optionally set default values for existing rows
UPDATE plans SET status = 'ACTIVE' WHERE status IS NULL;
UPDATE subscriptions SET status = 'ACTIVE' WHERE status IS NULL;
