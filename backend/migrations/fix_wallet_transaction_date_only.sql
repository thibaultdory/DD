-- Migration: Fix wallet_transactions.date_only to be derived from `date`
-- Problem: a previous migration set DEFAULT CURRENT_DATE, which breaks reprocessing and can block future rewards.

-- 1) Backfill any incorrect values (including rows inserted while the default was wrong)
UPDATE wallet_transactions
SET date_only = date::date
WHERE date_only IS DISTINCT FROM date::date;

-- 2) Remove the dangerous default (application code + trigger will populate correctly)
ALTER TABLE wallet_transactions
ALTER COLUMN date_only DROP DEFAULT;

