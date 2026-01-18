-- Migration 052: Add affordable_home_price column to calculated_metrics
-- Affordable Home Price = max home price a household can afford based on median income
-- Formula: Solve for home price given income, 28% DTI, current rates, 20% down

-- Add the new column
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS affordable_home_price NUMERIC;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_calculated_metrics_affordable_home_price
ON calculated_metrics (geography_type, period_date)
WHERE affordable_home_price IS NOT NULL;

-- Add comment
COMMENT ON COLUMN calculated_metrics.affordable_home_price IS 'Maximum home price affordable based on median income, 28% DTI, current mortgage rates, 20% down payment';
