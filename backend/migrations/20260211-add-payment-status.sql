-- Migration: add status column to payments table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';
