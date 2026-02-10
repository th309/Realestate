/**
 * Seed Entitlements Features
 *
 * Populates the feature_definitions and tier_features tables with
 * all metrics, geo levels, and features needed for the entitlements system.
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
// CONFIGURATION: Define which tiers get access to which features
// ============================================================================

// Metrics available to each tier
const METRIC_ACCESS: Record<string, string[]> = {
  // Free tier - basic metrics only
  free: [
    'home_value',
    'home_value_yoy',
    'home_value_mom',
    'population',
    'median_income',
  ],

  // Pro tier - most metrics
  pro: [
    // All free metrics plus:
    'home_price_forecast',
    'home_value_5yr',  // 5-year growth rate
    'rent_index',
    'rent_for_houses',
    'for_sale_inventory',
    'inventory_yoy',
    'new_listings',
    'pending_listings',
    'home_sales',
    'home_sales_yoy',
    'pending_ratio',
    'days_on_market',
    'market_heat',
    'price_cut_pct',
    'sale_to_list',
    'homeowner_affordability',
    'renter_affordability',
    'years_to_save',
    'income_to_buy',
    'income_to_rent',
    'affordable_home_price',
    'listing_price',
    'price_per_sqft',
    'price_increase_pct',
    'new_listings_yoy',
    'hotness_score',
    'supply_score',
    'demand_score',
    'cap_rate',
    'gross_yield',
    'grm',
    'rent_to_price_ratio',
    'investment_score',
    'population_growth',
    'income_growth',
    'median_age',
    'homeownership_rate',
    'unemployment_rate',
    'job_growth',
    'cost_of_living',
    'homeready_score',
    'investoredge_score',
    'market_health_score',
  ],

  // Enterprise tier - everything
  enterprise: [
    // All pro metrics plus:
    'long_term_growth_score',
    'overvalued_pct',
    'inventory_surplus',
    'new_construction_sales',
    'new_construction_price',
    'new_construction_ppsf',
    'sf_permits',
    'mf_permits',
    'total_permits',
    'permits_yoy',
    'sf_mf_ratio',
    'permit_value_per_unit',
    'gdp_growth',
  ],

  // Admin - all
  admin: ['*'],
};

// Geography levels available to each tier
const GEO_ACCESS: Record<string, string[]> = {
  free: ['national', 'state'],
  pro: ['national', 'state', 'metro', 'county', 'city'],
  enterprise: ['national', 'state', 'metro', 'county', 'city', 'zip', 'tract'],
  admin: ['national', 'state', 'metro', 'county', 'city', 'zip', 'tract'],
};

// Features available to each tier
const FEATURE_ACCESS: Record<string, string[]> = {
  free: [],
  pro: ['export_csv', 'reports'],
  enterprise: ['export_csv', 'reports', 'ai_insights', 'analytics_assistant', 'scores'],
  admin: ['export_csv', 'reports', 'ai_insights', 'analytics_assistant', 'scores'],
};

// All metrics (complete list)
const ALL_METRICS = [
  'affordable_home_price', 'cap_rate', 'cost_of_living', 'days_on_market',
  'demand_score', 'for_sale_inventory', 'gdp_growth', 'grm', 'gross_yield',
  'home_price_forecast', 'home_sales', 'home_sales_yoy', 'home_value',
  'home_value_5yr', 'home_value_mom', 'home_value_yoy', 'homeowner_affordability',
  'homeownership_rate', 'homeready_score', 'hotness_score', 'income_growth',
  'income_to_buy', 'income_to_rent', 'inventory_surplus', 'inventory_yoy',
  'investment_score', 'investoredge_score', 'job_growth', 'listing_price',
  'long_term_growth_score', 'market_health_score', 'market_heat', 'median_age',
  'median_income', 'mf_permits', 'new_construction_ppsf', 'new_construction_price',
  'new_construction_sales', 'new_listings', 'new_listings_yoy', 'overvalued_pct',
  'pending_listings', 'pending_ratio', 'permit_value_per_unit', 'permits_yoy',
  'population', 'population_growth', 'price_cut_pct', 'price_increase_pct',
  'price_per_sqft', 'rent_for_houses', 'rent_index', 'rent_to_price_ratio',
  'renter_affordability', 'sale_to_list', 'sf_mf_ratio', 'sf_permits',
  'supply_score', 'total_permits', 'unemployment_rate', 'years_to_save',
];

const ALL_GEOS = ['national', 'state', 'metro', 'county', 'city', 'zip', 'tract'];
const ALL_FEATURES = ['analytics_assistant', 'export_csv', 'reports', 'ai_insights', 'scores'];

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function getTierIds(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('subscription_tiers')
    .select('id, slug');

  if (error) throw error;

  const tierMap: Record<string, string> = {};
  for (const tier of data || []) {
    tierMap[tier.slug] = tier.id;
  }
  return tierMap;
}

async function createFeatureDefinition(
  slug: string,
  name: string,
  category: string,
): Promise<string> {
  // Check if exists
  const { data: existing } = await supabase
    .from('feature_definitions')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    console.log(`  Feature exists: ${slug}`);
    return existing.id;
  }

  // Create new
  const { data, error } = await supabase
    .from('feature_definitions')
    .insert({
      slug,
      name,
      category,
      value_type: 'boolean',
      default_value: false,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) throw error;
  console.log(`  Created feature: ${slug}`);
  return data.id;
}

async function setTierFeature(
  tierId: string,
  featureId: string,
  value: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('tier_features')
    .upsert({
      tier_id: tierId,
      feature_id: featureId,
      value,
    }, {
      onConflict: 'tier_id,feature_id',
    });

  if (error) throw error;
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
  console.log('Seeding entitlements features...\n');

  // Get tier IDs
  console.log('Fetching tier IDs...');
  const tierIds = await getTierIds();
  console.log('Tiers:', Object.keys(tierIds).join(', '), '\n');

  // Create metric features
  console.log('Creating metric features...');
  const metricFeatureIds: Record<string, string> = {};
  for (const metricId of ALL_METRICS) {
    const slug = `metric_${metricId}`;
    const name = `${formatMetricName(metricId)} Metric`;
    metricFeatureIds[metricId] = await createFeatureDefinition(slug, name, 'metrics');
  }

  // Create geo features
  console.log('\nCreating geography features...');
  const geoFeatureIds: Record<string, string> = {};
  for (const geoId of ALL_GEOS) {
    const slug = `geo_${geoId}`;
    const name = formatGeoName(geoId);
    geoFeatureIds[geoId] = await createFeatureDefinition(slug, name, 'geography');
  }

  // Create feature features
  console.log('\nCreating app features...');
  const appFeatureIds: Record<string, string> = {};
  for (const featureId of ALL_FEATURES) {
    const slug = `feature_${featureId}`;
    const name = formatMetricName(featureId);
    appFeatureIds[featureId] = await createFeatureDefinition(slug, name, 'features');
  }

  // Set tier-feature mappings
  console.log('\nSetting tier-feature mappings...');

  for (const [tierSlug, tierId] of Object.entries(tierIds)) {
    console.log(`\n  ${tierSlug.toUpperCase()}:`);

    // Metrics
    const tierMetrics = METRIC_ACCESS[tierSlug] || [];
    const hasAllMetrics = tierMetrics.includes('*');

    for (const metricId of ALL_METRICS) {
      // Include if tier has '*' or if metric is in parent tier's list
      const tiers = ['free', 'pro', 'enterprise', 'admin'];
      const tierIndex = tiers.indexOf(tierSlug);

      let hasAccess = hasAllMetrics;
      if (!hasAccess) {
        // Check this tier and all lower tiers
        for (let i = 0; i <= tierIndex; i++) {
          const checkTier = tiers[i];
          if (METRIC_ACCESS[checkTier]?.includes(metricId) || METRIC_ACCESS[checkTier]?.includes('*')) {
            hasAccess = true;
            break;
          }
        }
      }

      await setTierFeature(tierId, metricFeatureIds[metricId], hasAccess);
    }
    console.log(`    Metrics: ${hasAllMetrics ? 'all' : tierMetrics.length} configured`);

    // Geos
    const tierGeos = GEO_ACCESS[tierSlug] || [];
    for (const geoId of ALL_GEOS) {
      const hasAccess = tierGeos.includes(geoId);
      await setTierFeature(tierId, geoFeatureIds[geoId], hasAccess);
    }
    console.log(`    Geos: ${tierGeos.join(', ')}`);

    // Features
    const tierFeatures = FEATURE_ACCESS[tierSlug] || [];
    for (const featureId of ALL_FEATURES) {
      const hasAccess = tierFeatures.includes(featureId);
      await setTierFeature(tierId, appFeatureIds[featureId], hasAccess);
    }
    console.log(`    Features: ${tierFeatures.length > 0 ? tierFeatures.join(', ') : 'none'}`);
  }

  console.log('\n✅ Seed complete!');
}

main().catch(console.error);
