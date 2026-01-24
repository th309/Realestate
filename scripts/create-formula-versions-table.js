/**
 * Create formula versions table and seed initial data
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envPaths = [
  path.join(__dirname, '..', 'packages', 'backend', '.env'),
  path.join(__dirname, '..', '.env.local'),
];

for (const envPath of envPaths) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const eqIndex = trimmedLine.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmedLine.substring(0, eqIndex).trim();
          const value = trimmedLine.substring(eqIndex + 1).trim();
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  } catch (e) {}
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('Creating propertyiq_formula_versions table...\n');

  // Create table using RPC or direct SQL
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS propertyiq_formula_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      version VARCHAR(20) NOT NULL,
      score_type VARCHAR(20) NOT NULL,
      formula_config JSONB NOT NULL,
      description TEXT,
      created_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      is_active BOOLEAN DEFAULT FALSE,
      is_default BOOLEAN DEFAULT FALSE,
      parent_version VARCHAR(20),
      change_notes TEXT,
      CONSTRAINT valid_score_type CHECK (score_type IN ('market_health', 'homeready', 'investoredge')),
      UNIQUE(version, score_type)
    );

    CREATE INDEX IF NOT EXISTS idx_formula_versions_active
      ON propertyiq_formula_versions(score_type, is_active)
      WHERE is_active = TRUE;

    CREATE INDEX IF NOT EXISTS idx_formula_versions_default
      ON propertyiq_formula_versions(score_type, is_default)
      WHERE is_default = TRUE;
  `;

  // Try using rpc to execute SQL
  const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });

  if (createError) {
    console.log('Note: Could not create table via RPC (this is normal if table exists or RPC not available)');
    console.log('Error:', createError.message);
    console.log('\nTrying direct insert to see if table exists...');
  }

  // Seed initial data
  console.log('\nSeeding initial formula versions...');

  const versions = [
    {
      version: '1.0.0',
      score_type: 'market_health',
      formula_config: {
        components: {
          demand_strength: { weight: 0.35, metrics: ['pending_ratio', 'median_days_on_market', 'hotness_score'] },
          supply_balance: { weight: 0.25, metrics: ['months_of_supply', 'active_listing_count_yy', 'new_listing_count_yy'] },
          price_stability: { weight: 0.25, metrics: ['price_reduced_share', 'sale_to_list_ratio', 'zhvi_yoy'] },
          economic_foundation: { weight: 0.15, metrics: ['unemployment_rate', 'employment_yoy'] }
        }
      },
      description: 'Initial Market Health formula',
      is_active: true,
      is_default: true
    },
    {
      version: '1.0.0',
      score_type: 'homeready',
      formula_config: {
        components: {
          affordability: { weight: 0.30, metrics: ['zhvi', 'zori', 'homeowner_income', 'renter_income', 'affordable_price'] },
          market_timing: { weight: 0.25, metrics: ['pending_ratio', 'days_on_market', 'price_reduced_share', 'pending_listing_count_yy'] },
          stability: { weight: 0.20, metrics: ['zhvi_volatility', 'volatility_36m', 'inventory', 'months_supply', 'dom', 'price_cuts'] },
          growth_potential: { weight: 0.15, metrics: ['zhvi_5y_cagr', 'population_yoy', 'median_household_income_yoy'] },
          livability: { weight: 0.10, metrics: ['homeownership_rate', 'median_age', 'population_growth', 'median_income'] }
        }
      },
      description: 'Initial HomeReady formula',
      is_active: true,
      is_default: true
    },
    {
      version: '1.0.0',
      score_type: 'investoredge',
      formula_config: {
        components: {
          cash_flow: { weight: 0.35, metrics: ['cap_rate', 'grm', 'rent_yield', 'gross_yield', 'rent_to_price_ratio'] },
          rent_demand: { weight: 0.20, metrics: ['zori_yoy', 'vacancy_rate', 'renter_share'] },
          appreciation: { weight: 0.20, metrics: ['zhvi_yoy', 'zhvi_3y_cagr'] },
          entry_point: { weight: 0.15, metrics: ['overvalued_pct', 'days_on_market', 'price_reduced_share'] },
          risk: { weight: 0.10, metrics: ['unemployment_rate', 'inventory_volatility', 'inventory_surplus_pct', 'large_multi_permits_yoy'] }
        }
      },
      description: 'Initial InvestorEdge formula',
      is_active: true,
      is_default: true
    }
  ];

  for (const v of versions) {
    const { data, error: insertError } = await supabase
      .from('propertyiq_formula_versions')
      .upsert(v, { onConflict: 'version,score_type' })
      .select();

    if (insertError) {
      console.log('Error inserting ' + v.score_type + ':', insertError.message);
    } else {
      console.log('Inserted/Updated ' + v.score_type + ' v' + v.version);
    }
  }

  // Verify
  console.log('\nVerifying...');
  const { data: check, error: checkError } = await supabase
    .from('propertyiq_formula_versions')
    .select('score_type, version, is_active')
    .order('score_type');

  if (checkError) {
    console.log('Verification error:', checkError.message);
  } else {
    console.log('Formula versions in database:');
    check.forEach(v => console.log('  - ' + v.score_type + ' v' + v.version + ' (active: ' + v.is_active + ')'));
  }
}

main().catch(console.error);
