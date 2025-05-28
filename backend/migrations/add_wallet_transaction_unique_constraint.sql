-- Migration: Add unique constraint for daily reward transactions
-- This prevents duplicate daily rewards for the same child/contract/date combination

-- Add the date_only column
ALTER TABLE wallet_transactions 
ADD COLUMN date_only DATE;

-- Populate the date_only column with existing data
UPDATE wallet_transactions 
SET date_only = date::date;

-- Make the column NOT NULL
ALTER TABLE wallet_transactions 
ALTER COLUMN date_only SET NOT NULL;

-- Set default value for future inserts
ALTER TABLE wallet_transactions 
ALTER COLUMN date_only SET DEFAULT CURRENT_DATE;

-- Add the unique constraint for daily rewards only
CREATE UNIQUE INDEX uq_daily_reward_per_child_contract_date 
ON wallet_transactions (child_id, contract_id, date_only, reason)
WHERE reason = 'Récompense journalière';

-- Add a comment explaining the constraint
COMMENT ON INDEX uq_daily_reward_per_child_contract_date IS 
'Prevents duplicate daily reward transactions for the same child, contract, and date'; 