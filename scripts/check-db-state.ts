/**
 * Quick database state check
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Checking database state...\n');

  // 1. Total count
  const { count: total } = await supabase
    .from('propertyiq_scores_history')
    .select('*', { count: 'exact', head: true });
  console.log(`Total history records: ${total?.toLocaleString() || 0}`);

  // 2. Sample records
  const { data: samples } = await supabase
    .from('propertyiq_scores_history')
    .select('period_date, geography_type, geography_id')
    .order('period_date', { ascending: false })
    .limit(5);
  console.log('\nLatest records:');
  if (samples) {
    for (const s of samples) {
      console.log(`  ${s.period_date} - ${s.geography_type}: ${s.geography_id}`);
    }
  }

  // 3. Date range
  const { data: minDate } = await supabase
    .from('propertyiq_scores_history')
    .select('period_date')
    .order('period_date', { ascending: true })
    .limit(1);
  const { data: maxDate } = await supabase
    .from('propertyiq_scores_history')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1);
  console.log(`\nDate range: ${minDate?.[0]?.period_date || 'N/A'} to ${maxDate?.[0]?.period_date || 'N/A'}`);

  // 4. Records older than cutoff
  const { count: oldEnough } = await supabase
    .from('propertyiq_scores_history')
    .select('*', { count: 'exact', head: true })
    .lte('period_date', '2024-12-01');
  console.log(`Records <= 2024-12-01: ${oldEnough?.toLocaleString() || 0}`);

  // 5. Records with outcomes
  const { count: withOutcomes } = await supabase
    .from('propertyiq_scores_history')
    .select('*', { count: 'exact', head: true })
    .not('actual_appreciation_12m', 'is', null);
  console.log(`Records with 12m outcomes: ${withOutcomes?.toLocaleString() || 0}`);

  // 6. By geography type
  console.log('\nBy geography type:');
  for (const geoType of ['state', 'metro', 'county', 'zip']) {
    const { count } = await supabase
      .from('propertyiq_scores_history')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', geoType);
    console.log(`  ${geoType}: ${count?.toLocaleString() || 0}`);
  }

  console.log('\n✓ Check complete');
}

main().catch(console.error);
