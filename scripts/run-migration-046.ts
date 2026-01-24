/**
 * Run Migration 046: Add backtest horizon columns
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Running Migration 046: Add backtest horizon columns...\n');

  // Check current columns
  console.log('Checking existing columns...');
  const { data: existingCols } = await supabase
    .from('propertyiq_scores_history')
    .select('*')
    .limit(1);

  if (existingCols && existingCols[0]) {
    const cols = Object.keys(existingCols[0]);
    console.log(`Current columns (${cols.length}): ${cols.join(', ')}\n`);
  }

  // The columns will be added via Supabase SQL Editor since ALTER TABLE
  // isn't available through the JS client. Let's verify what we need.

  const columnsToAdd = [
    'actual_appreciation_36m',
    'actual_appreciation_60m',
    'actual_appreciation_120m',
    'actual_rent_growth_24m',
    'actual_rent_growth_36m',
    'actual_rent_growth_60m',
    'prediction_error_36m',
    'prediction_error_60m'
  ];

  console.log('Columns to add (run in Supabase SQL Editor):');
  console.log('─'.repeat(60));
  console.log(`
ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS actual_appreciation_36m NUMERIC(6,3),
ADD COLUMN IF NOT EXISTS actual_appreciation_60m NUMERIC(6,3),
ADD COLUMN IF NOT EXISTS actual_appreciation_120m NUMERIC(6,3);

ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS actual_rent_growth_24m NUMERIC(6,3),
ADD COLUMN IF NOT EXISTS actual_rent_growth_36m NUMERIC(6,3),
ADD COLUMN IF NOT EXISTS actual_rent_growth_60m NUMERIC(6,3);

ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS prediction_error_36m NUMERIC(6,3),
ADD COLUMN IF NOT EXISTS prediction_error_60m NUMERIC(6,3);

-- Indexes for backtesting queries
CREATE INDEX IF NOT EXISTS idx_history_investoredge_outcomes
  ON propertyiq_scores_history(investoredge_score, actual_appreciation_12m)
  WHERE investoredge_score IS NOT NULL AND actual_appreciation_12m IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_history_homeready_outcomes
  ON propertyiq_scores_history(homeready_score, actual_appreciation_12m)
  WHERE homeready_score IS NOT NULL AND actual_appreciation_12m IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_history_market_health_outcomes
  ON propertyiq_scores_history(market_health_score, actual_appreciation_12m)
  WHERE market_health_score IS NOT NULL AND actual_appreciation_12m IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_history_period_type
  ON propertyiq_scores_history(period_date, geography_type);
`);
  console.log('─'.repeat(60));

  console.log('\nPlease run the above SQL in Supabase SQL Editor.');
  console.log('After running, this script will verify the columns exist.\n');

  // Test insert to verify columns exist
  console.log('Testing if new columns exist...');
  const testRecord = {
    geography_id: 'MIGRATION_TEST_046',
    geography_type: 'state',
    period_date: '2020-01-01',
    market_health_score: 50,
    homeready_score: 50,
    investoredge_score: 50,
    actual_appreciation_36m: 0.15,
    actual_appreciation_60m: 0.25,
    actual_appreciation_120m: 0.50,
  };

  const { error: insertError } = await supabase
    .from('propertyiq_scores_history')
    .upsert(testRecord, { onConflict: 'geography_id,geography_type,period_date' });

  if (insertError) {
    if (insertError.message.includes('actual_appreciation_36m') ||
        insertError.message.includes('actual_appreciation_60m') ||
        insertError.message.includes('actual_appreciation_120m')) {
      console.log('❌ New columns do NOT exist yet. Please run the SQL migration first.\n');
      console.log(`Error: ${insertError.message}`);
    } else {
      console.log(`Insert error (may be unrelated): ${insertError.message}`);
    }
  } else {
    console.log('✓ New columns exist! Migration successful.\n');

    // Clean up test record
    await supabase
      .from('propertyiq_scores_history')
      .delete()
      .eq('geography_id', 'MIGRATION_TEST_046');

    console.log('Test record cleaned up.');
  }
}

main().catch(console.error);
