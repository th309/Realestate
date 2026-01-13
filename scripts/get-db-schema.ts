import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function getSchema() {
  // Query information_schema to get all tables
  const { data: tables, error: tablesError } = await supabase
    .rpc('get_all_tables');

  if (tablesError) {
    // Try direct query approach - get sample from each known table
    console.log('RPC not available, querying tables directly...\n');

    // List of potential tables to check
    const potentialTables = [
      // Zillow tables
      'zillow_zhvi', 'zillow_zori', 'zillow_zordi', 'zillow_zhvf',
      'zillow_inventory', 'zillow_new_listings', 'zillow_pending_listings',
      'zillow_median_list_price', 'zillow_sales_count', 'zillow_sales_price',
      'zillow_sale_to_list', 'zillow_days_to_pending', 'zillow_days_to_close',
      'zillow_market_heat_index', 'zillow_price_cut_share', 'zillow_price_cut_amt',
      'zillow_price_cut_pct', 'zillow_new_construction_sales_count',
      'zillow_new_construction_sale_price', 'zillow_affordability',
      'zillow_sale_to_list_ratio', 'zillow_sale_list_percent', 'zillow_price_cuts',
      'zillow_total_transaction_value',
      // Reference tables
      'markets', 'geography_crosswalk', 'geographies',
      'tiger_states', 'tiger_counties', 'tiger_cbsa', 'tiger_zcta', 'tiger_places',
      'geographic_units', 'markets_hierarchy', 'markets_tiger_mapping',
      // Census tables
      'census_demographics', 'census_economics', 'census_housing', 'census_data',
      // FRED tables
      'fred_economic_data', 'fred_data',
      // Redfin tables
      'redfin_metrics',
      // Application tables
      'reports', 'report_conversations', 'user_report_memory',
      'news_cache', 'data_ingestion_log', 'data_source_registry',
      // Other tables
      'master_market_intelligence', 'market_signals',
      'subscriber_reports', 'subscriber_profiles', 'subscriber_requests',
      'metric_definitions', 'metric_percentiles', 'calculated_metrics',
      'propertyiq_scores'
    ];

    const existingTables: { name: string; columns: string[]; rowCount: number }[] = [];

    for (const tableName of potentialTables) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: false })
          .limit(1);

        if (!error && data) {
          const columns = data.length > 0 ? Object.keys(data[0]) : [];
          existingTables.push({
            name: tableName,
            columns,
            rowCount: count || 0
          });
        }
      } catch (e) {
        // Table doesn't exist, skip
      }
    }

    console.log('=== EXISTING TABLES IN DATABASE ===\n');

    // Group by category
    const zillowTables = existingTables.filter(t => t.name.startsWith('zillow_'));
    const tigerTables = existingTables.filter(t => t.name.startsWith('tiger_'));
    const otherTables = existingTables.filter(t => !t.name.startsWith('zillow_') && !t.name.startsWith('tiger_'));

    console.log('--- ZILLOW TABLES ---');
    for (const table of zillowTables) {
      console.log(`\n${table.name} (${table.rowCount.toLocaleString()} rows)`);
      console.log(`  Columns: ${table.columns.join(', ')}`);
    }

    console.log('\n\n--- TIGER/GEOGRAPHIC TABLES ---');
    for (const table of tigerTables) {
      console.log(`\n${table.name} (${table.rowCount.toLocaleString()} rows)`);
      console.log(`  Columns: ${table.columns.join(', ')}`);
    }

    console.log('\n\n--- OTHER TABLES ---');
    for (const table of otherTables) {
      console.log(`\n${table.name} (${table.rowCount.toLocaleString()} rows)`);
      console.log(`  Columns: ${table.columns.join(', ')}`);
    }

    console.log('\n\n=== SUMMARY ===');
    console.log(`Total tables found: ${existingTables.length}`);
    console.log(`Zillow tables: ${zillowTables.length}`);
    console.log(`Tiger/Geographic tables: ${tigerTables.length}`);
    console.log(`Other tables: ${otherTables.length}`);

    return;
  }

  console.log('Tables:', tables);
}

getSchema().catch(console.error);
