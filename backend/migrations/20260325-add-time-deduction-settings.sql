-- Migration: add time deduction settings to payroll_settings table
-- Adds deductionEnabled, workStartTime, workEndTime, workingDaysPerMonth
BEGIN;

ALTER TABLE payroll_settings
  ADD COLUMN IF NOT EXISTS deduction_enabled      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS work_start_time        varchar(5) NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS work_end_time          varchar(5) NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS working_days_per_month integer NOT NULL DEFAULT 26;

COMMIT;
