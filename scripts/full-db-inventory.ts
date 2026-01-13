import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function run() {
  // Comprehensive list of all possible tables
  const allPossibleTables = [
    // Zillow data tables
    'zillow_zhvi', 'zillow_zori', 'zillow_zordi', 'zillow_zhvf',
    'zillow_inventory', 'zillow_new_listings', 'zillow_pending_listings',
    'zillow_median_list_price', 'zillow_sales_count', 'zillow_sales_price',
    'zillow_sale_to_list', 'zillow_days_to_pending', 'zillow_days_to_close',
    'zillow_market_heat_index', 'zillow_price_cut_share', 'zillow_price_cut_amt',
    'zillow_price_cut_pct', 'zillow_new_construction_sales_count',
    'zillow_new_construction_sale_price', 'zillow_affordability',
    'zillow_sale_to_list_ratio', 'zillow_sale_list_percent', 'zillow_price_cuts',
    'zillow_total_transaction_value',
    // Geographic/Reference tables
    'markets', 'geography_crosswalk', 'geographies', 'geographic_units',
    'markets_hierarchy', 'markets_tiger_mapping',
    'tiger_states', 'tiger_counties', 'tiger_cbsa', 'tiger_zcta',
    'tiger_places', 'tiger_csa', 'tiger_metdiv', 'tiger_nation',
    // Census tables
    'census_data', 'census_demographics', 'census_economics', 'census_housing',
    // FRED tables
    'fred_data', 'fred_economic_data',
    // Redfin tables
    'redfin_metrics',
    // Reports & Conversations
    'reports', 'report_conversations', 'user_report_memory',
    // Application tables
    'news_cache', 'data_ingestion_log', 'data_source_registry',
    'metric_definitions', 'metric_percentiles', 'calculated_metrics',
    'propertyiq_scores', 'market_signals',
    // Intelligence tables
    'master_market_intelligence',
    // Subscriber tables
    'subscriber_reports', 'subscriber_profiles', 'subscriber_requests',
    // Other possible tables
    'users', 'organizations', 'subscriptions', 'notifications',
    'workflow_templates', 'spatial_staging', 'spatial_uploads'
  ];

  const results: { name: string; rows: number; columns: string[] }[] = [];
  const notFound: string[] = [];

  for (const tableName of allPossibleTables) {
    try {
      const { data, count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (error) {
        notFound.push(tableName);
      } else {
        const cols = data && data.length > 0 ? Object.keys(data[0]) : [];
        results.push({
          name: tableName,
          rows: count || 0,
          columns: cols
        });
      }
    } catch (e) {
      notFound.push(tableName);
    }
  }

  // Sort by category and row count
  const withData = results.filter(r => r.rows > 0).sort((a, b) => b.rows - a.rows);
  const empty = results.filter(r => r.rows === 0);

  console.log('=== TABLES WITH DATA ===\n');
  for (const t of withData) {
    console.log(`${t.name} (${t.rows.toLocaleString()} rows)`);
    console.log(`  Columns: ${t.columns.join(', ')}\n`);
  }

  console.log('\n=== EMPTY TABLES ===\n');
  for (const t of empty) {
    console.log(`${t.name}`);
  }

  console.log('\n=== TABLES NOT FOUND ===\n');
  console.log(notFound.join(', '));

  console.log('\n\n=== SUMMARY ===');
  console.log(`Tables with data: ${withData.length}`);
  console.log(`Empty tables: ${empty.length}`);
  console.log(`Tables not found: ${notFound.length}`);
  console.log(`Total rows across all tables: ${withData.reduce((sum, t) => sum + t.rows, 0).toLocaleString()}`);
}

run().catch(console.error);
