-- Migration 052: Add years_to_save column to calculated_metrics table
--
-- This column stores the number of years needed to save for a 20% down payment
-- assuming a 10% savings rate from median household income.
-- Formula: (Median listing price × 0.20) / (Median Income × 0.10)
--

-- Add years_to_save column if it doesn't exist
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS years_to_save DECIMAL(5,1);

-- Add a comment for documentation
COMMENT ON COLUMN calculated_metrics.years_to_save IS 'Years to save for 20% down payment at 10% savings rate';
