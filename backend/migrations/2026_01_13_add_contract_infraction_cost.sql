-- Add per-contract infraction cost (penalty for 2nd+ infraction per day)
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS infraction_cost DOUBLE PRECISION NOT NULL DEFAULT 0;

