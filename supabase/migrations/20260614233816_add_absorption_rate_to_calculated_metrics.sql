-- The calculated_metrics service writes `absorption_rate` (declared in
-- CalculatedMetricsOutput, written by storeMetrics and by the bulk investment
-- methods' months-of-supply proxy), but the column was never added to the table.
-- Every latest-period investment upsert that included it failed with
-- "Could not find the 'absorption_rate' column of 'calculated_metrics'",
-- which silently dropped the months_of_supply + cap_rate writes for that batch.
-- Add the column (additive, nullable). Table-level GRANTs already cover it.
ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS absorption_rate numeric;
