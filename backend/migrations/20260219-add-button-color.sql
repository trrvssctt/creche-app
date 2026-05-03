-- Migration: add button_color column to tenants for tenant-level button customization
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS button_color VARCHAR(7);

-- No default: if not set, frontend will fallback to --primary-kernel
