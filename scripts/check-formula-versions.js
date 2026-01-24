/**
 * Check formula versions in database
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
  console.log('Checking formula versions...\n');

  const { data, error } = await supabase
    .from('propertyiq_formula_versions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No formula versions found! Seeding the database...');

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
      const { error: insertError } = await supabase
        .from('propertyiq_formula_versions')
        .insert(v);

      if (insertError) {
        console.log('Error inserting ' + v.score_type + ':', insertError.message);
      } else {
        console.log('Inserted ' + v.score_type + ' v' + v.version);
      }
    }

    return;
  }

  console.log('Found ' + data.length + ' formula versions:\n');

  for (const v of data) {
    console.log(v.score_type + ' v' + v.version);
    console.log('  Active: ' + v.is_active + ', Default: ' + v.is_default);
    console.log('  Created: ' + v.created_at);
    const components = v.formula_config && v.formula_config.components ? Object.keys(v.formula_config.components) : [];
    console.log('  Components: ' + components.join(', '));
    console.log('');
  }
}

main().catch(console.error);
