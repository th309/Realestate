/**
 * Explore Supabase Database Structure
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function explore() {
  console.log('=== SUPABASE DATABASE EXPLORATION ===\n');

  // Get list of tables
  const { data: tables, error: tablesError } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
    });

  if (tablesError) {
    console.log('RPC not available, trying direct queries...\n');

    // Try querying known tables
    const knownTables = [
      'tiger_states', 'tiger_counties', 'tiger_zcta',
      'markets', 'zillow_zhvi', 'zillow_zori',
      'zillow_metrics', 'redfin_metrics'
    ];

    for (const tableName of knownTables) {
      console.log(`\n--- ${tableName} ---`);

      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`  Error: ${error.message}`);
      } else {
        console.log(`  Row count: ${count}`);

        // Get sample row to see columns
        const { data: sample } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (sample && sample.length > 0) {
          console.log('  Columns:', Object.keys(sample[0]).join(', '));
        }
      }
    }
  } else {
    console.log('Tables found:', tables);
  }

  // Check specific data for home values
  console.log('\n\n=== CHECKING FOR HOME VALUE DATA ===\n');

  // Check tiger_states
  console.log('1. tiger_states sample:');
  const { data: states } = await supabase
    .from('tiger_states')
    .select('*')
    .limit(3);
  if (states) console.table(states);

  // Check markets table
  console.log('\n2. markets sample (state type):');
  const { data: stateMarkets, count: stateCount } = await supabase
    .from('markets')
    .select('*', { count: 'exact' })
    .eq('region_type', 'state')
    .limit(3);
  console.log(`   State market count: ${stateCount}`);
  if (stateMarkets) console.table(stateMarkets);

  // Check zillow_zhvi
  console.log('\n3. zillow_zhvi sample:');
  const { data: zhvi, count: zhviCount, error: zhviErr } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact' })
    .eq('geography', 'state')
    .limit(3);
  if (zhviErr) {
    console.log(`   Error: ${zhviErr.message}`);
  } else {
    console.log(`   State ZHVI count: ${zhviCount}`);
    if (zhvi) console.table(zhvi);
  }

  // Check redfin_metrics
  console.log('\n4. redfin_metrics sample:');
  const { data: redfin, count: redfinCount, error: redfinErr } = await supabase
    .from('redfin_metrics')
    .select('*', { count: 'exact' })
    .limit(3);
  if (redfinErr) {
    console.log(`   Error: ${redfinErr.message}`);
  } else {
    console.log(`   Redfin metrics count: ${redfinCount}`);
    if (redfin) console.table(redfin);
  }

  console.log('\n=== EXPLORATION COMPLETE ===');
}

explore().catch(console.error);
