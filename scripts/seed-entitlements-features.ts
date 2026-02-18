/**
 * Seed Entitlements Feature Definitions
 *
 * Populates the feature_definitions table with all metrics, geo levels,
 * and features needed for the entitlements system.
 *
 * IMPORTANT: This script only creates feature definitions. It does NOT
 * set tier assignments. Tier assignments are managed exclusively through
 * the admin entitlements/tiers page.
 *
 * Run: npx tsx scripts/seed-entitlements-features.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// FEATURE DEFINITIONS: All metrics, geos, and features the platform supports
// ============================================================================

const ALL_METRICS = [
  'affordable_home_price', 'cap_rate', 'cost_of_living', 'days_on_market',
  'demand_score', 'for_sale_inventory', 'gdp_growth', 'grm', 'gross_yield',
  'home_price_forecast', 'home_sales', 'home_sales_yoy', 'home_value',
  'home_value_3yr', 'home_value_5yr', 'home_value_mom', 'home_value_yoy', 'homeowner_affordability',
  'homeownership_rate', 'homeready_score', 'hotness_score', 'income_growth',
  'income_to_buy', 'income_to_rent', 'inventory_surplus', 'inventory_yoy',
  'investment_score', 'investoredge_score', 'job_growth', 'listing_price',
  'long_term_growth_score', 'market_health_score', 'market_heat', 'median_age',
  'median_income', 'mf_permits', 'new_construction_ppsf', 'new_construction_price',
  'new_construction_sales', 'new_listings', 'new_listings_yoy', 'overvalued_pct',
  'pending_listings', 'pending_ratio', 'permit_value_per_unit', 'permits_yoy',
  'population', 'population_growth', 'price_cut_pct', 'price_increase_pct',
  'price_per_sqft', 'rent_5yr', 'rent_for_houses', 'rent_index', 'rent_to_price_ratio', 'rent_yoy',
  'renter_affordability', 'sale_to_list', 'sf_mf_ratio', 'sf_permits',
  'supply_score', 'total_permits', 'unemployment_rate', 'years_to_save',
];

const ALL_GEOS = ['national', 'state', 'metro', 'county', 'city', 'zip', 'tract'];
const ALL_FEATURES = ['analytics_assistant', 'export_csv', 'reports', 'ai_insights', 'scores'];

// ============================================================================
// HELPERS
// ============================================================================

async function createFeatureDefinition(
  slug: string,
  name: string,
  category: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('feature_definitions')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    console.log(`  Exists: ${slug}`);
    return;
  }

  const { error } = await supabase
    .from('feature_definitions')
    .insert({
      slug,
      name,
      category,
      value_type: 'boolean',
      default_value: false,
      is_active: true,
    });

  if (error) throw error;
  console.log(`  Created: ${slug}`);
}

function formatMetricName(id: string): string {
  return id
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatGeoName(id: string): string {
  const names: Record<string, string> = {
    national: 'National Level',
    state: 'State Level',
    metro: 'Metro Level',
    county: 'County Level',
    city: 'City Level',
    zip: 'ZIP Code Level',
    tract: 'Census Tract Level',
  };
  return names[id] || id;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('Seeding feature definitions...\n');
  console.log('NOTE: This only creates feature definitions.');
  console.log('Tier assignments are managed via the admin entitlements/tiers page.\n');

  // Create metric feature definitions
  console.log('Metric features:');
  for (const metricId of ALL_METRICS) {
    await createFeatureDefinition(
      `metric_${metricId}`,
      `${formatMetricName(metricId)} Metric`,
      'metrics',
    );
  }

  // Create geo feature definitions
  console.log('\nGeography features:');
  for (const geoId of ALL_GEOS) {
    await createFeatureDefinition(
      `geo_${geoId}`,
      formatGeoName(geoId),
      'geography',
    );
  }

  // Create app feature definitions
  console.log('\nApp features:');
  for (const featureId of ALL_FEATURES) {
    await createFeatureDefinition(
      `feature_${featureId}`,
      formatMetricName(featureId),
      'features',
    );
  }

  console.log(`\nDone! ${ALL_METRICS.length} metrics + ${ALL_GEOS.length} geos + ${ALL_FEATURES.length} features = ${ALL_METRICS.length + ALL_GEOS.length + ALL_FEATURES.length} total definitions.`);
  console.log('Assign them to tiers at: /dev/admin/entitlements/tiers');
}

main().catch(console.error);
