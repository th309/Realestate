import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function main() {
  console.log('Checking table schemas...\n');

  // Check propertyiq_scores columns
  const { data: scores, error: scoresErr } = await supabase.from('propertyiq_scores').select('*').limit(1);
  if (scoresErr) {
    console.log('propertyiq_scores ERROR:', scoresErr.message);
  } else if (scores && scores.length > 0) {
    console.log('propertyiq_scores columns:');
    Object.keys(scores[0]).forEach(k => console.log('  -', k));
  } else {
    console.log('propertyiq_scores: EMPTY TABLE (checking structure via insert attempt)');
    // Try inserting a minimal record to see what columns exist
    const testRecord = {
      geography_id: 'TEST',
      geography_type: 'state',
      geography_name: 'Test',
      period_date: '2025-01-01',
      market_health_score: 50,
      homeready_score: 50,
      investoredge_score: 50
    };
    const { error: insertErr } = await supabase.from('propertyiq_scores').insert(testRecord);
    if (insertErr) {
      console.log('  Insert error shows:', insertErr.message);
    } else {
      // Clean up
      await supabase.from('propertyiq_scores').delete().eq('geography_id', 'TEST');
      console.log('  Basic insert worked');
    }
  }

  // Check realtor_county columns for state info
  console.log('\nrealtor_county state-related columns:');
  const { data: county } = await supabase.from('realtor_county').select('*').limit(1);
  if (county && county.length > 0) {
    const cols = Object.keys(county[0]);
    cols.filter(k => k.includes('state') || k === 'county_fips' || k === 'county_name')
      .forEach(k => console.log('  -', k));
  }

  // Check if history table exists
  console.log('\npropertyiq_scores_history:');
  const { error: histErr } = await supabase.from('propertyiq_scores_history').select('id').limit(1);
  console.log('  Status:', histErr ? 'NOT FOUND - ' + histErr.message : 'EXISTS');
}

main().catch(console.error);
