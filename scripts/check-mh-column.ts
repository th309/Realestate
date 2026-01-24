import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const test = {
    geography_id: 'MH_TEST',
    geography_type: 'state',
    geography_name: 'Test',
    period_date: '2025-01-01',
    market_health_score: 50
  };
  const { error } = await supabase.from('propertyiq_scores').insert(test);
  console.log('Market Health column:', error ? 'MISSING - ' + error.message : 'EXISTS');
  if (!error) await supabase.from('propertyiq_scores').delete().eq('geography_id', 'MH_TEST');

  // Check history table
  const { error: histErr } = await supabase.from('propertyiq_scores_history').select('id').limit(1);
  console.log('History table:', histErr ? 'MISSING' : 'EXISTS');
}

main();
