import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function main() {
  // Try to insert a minimal HomeReady/InvestorEdge record (no Market Health)
  const testRecord = {
    geography_id: 'TEST_CHECK',
    geography_type: 'state',
    geography_name: 'Test',
    period_date: '2025-01-01',
    homeready_score: 50,
    homeready_affordability: 50,
    homeready_stability: 50,
    homeready_value: 50,
    homeready_livability: 50,
    homeready_momentum: 50,
    investoredge_score: 50,
    investoredge_cashflow: 50,
    investoredge_growth: 50,
    investoredge_demand: 50,
    investoredge_entrypoint: 50,
    investoredge_risk: 50,
    confidence_level: 'medium'
  };

  console.log('Testing insert without Market Health columns...');
  const { error } = await supabase.from('propertyiq_scores').insert(testRecord);

  if (error) {
    console.log('Error:', error.message);
    console.log('\nThe table needs columns added. Please run this SQL in Supabase:');
    console.log('---');
    console.log(`
-- Add HomeReady columns if missing
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS homeready_score NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS homeready_affordability NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS homeready_stability NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS homeready_value NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS homeready_livability NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS homeready_momentum NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS homeready_trend TEXT;
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS homeready_trend_change NUMERIC(5,2);

-- Add InvestorEdge columns if missing
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS investoredge_score NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS investoredge_cashflow NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS investoredge_growth NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS investoredge_demand NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS investoredge_entrypoint NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS investoredge_risk NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS investoredge_trend TEXT;
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS investoredge_trend_change NUMERIC(5,2);

-- Add Market Health columns if missing
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_score NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_demand_strength NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_supply_balance NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_price_stability NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_economic_foundation NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_trend TEXT;
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_trend_change NUMERIC(5,2);

-- Add metadata columns
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS confidence_level TEXT DEFAULT 'medium';
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS metrics_available INTEGER;
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS metrics_total INTEGER;
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS data_freshness_days INTEGER;
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ DEFAULT NOW();

-- Create history table
CREATE TABLE IF NOT EXISTS propertyiq_scores_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  period_date DATE NOT NULL,
  market_health_score NUMERIC(5,2),
  homeready_score NUMERIC(5,2),
  investoredge_score NUMERIC(5,2),
  actual_appreciation_12m NUMERIC(6,3),
  actual_appreciation_24m NUMERIC(6,3),
  actual_rent_growth_12m NUMERIC(6,3),
  actual_dom_avg_12m NUMERIC(6,2),
  prediction_error_12m NUMERIC(6,3),
  prediction_error_24m NUMERIC(6,3),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcomes_updated_at TIMESTAMPTZ,
  CONSTRAINT unique_history_geography_period UNIQUE (geography_id, geography_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_propertyiq_history_geography ON propertyiq_scores_history(geography_id, geography_type, period_date DESC);
GRANT SELECT, INSERT, UPDATE ON propertyiq_scores_history TO authenticated;
GRANT SELECT ON propertyiq_scores_history TO anon;
    `);
  } else {
    console.log('Success! Table has required columns.');
    // Clean up
    await supabase.from('propertyiq_scores').delete().eq('geography_id', 'TEST_CHECK');
  }
}

main().catch(console.error);
