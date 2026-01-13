-- Add stable ordering for violations (needed for "first infraction free" rebalance)
ALTER TABLE rule_violations
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill safety (in case column existed nullable in some environments)
UPDATE rule_violations
SET created_at = NOW()
WHERE created_at IS NULL;

