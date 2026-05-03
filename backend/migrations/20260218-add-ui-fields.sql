-- Migration: add UI preference columns to tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS theme VARCHAR(10) DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS font_family TEXT,
  ADD COLUMN IF NOT EXISTS base_font_size INTEGER DEFAULT 14;
