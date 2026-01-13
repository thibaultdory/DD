-- Link wallet transactions to a specific rule violation (for penalty rebalancing/refunds)
ALTER TABLE wallet_transactions
ADD COLUMN IF NOT EXISTS violation_id UUID;

CREATE INDEX IF NOT EXISTS ix_wallet_transactions_violation_id
ON wallet_transactions (violation_id);

