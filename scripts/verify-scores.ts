import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== Score Verification ===\n');

  // Count by geography type in current scores
  console.log('Current Scores (propertyiq_scores):');
  for (const geoType of ['state', 'metro', 'county', 'zip']) {
    const { count } = await supabase
      .from('propertyiq_scores')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', geoType);
    console.log(`  ${geoType.padEnd(8)}: ${count?.toLocaleString()}`);
  }

  // Total current
  const { count: totalCurrent } = await supabase
    .from('propertyiq_scores')
    .select('*', { count: 'exact', head: true });
  console.log(`  TOTAL   : ${totalCurrent?.toLocaleString()}`);

  // History count
  const { count: historyCount } = await supabase
    .from('propertyiq_scores_history')
    .select('*', { count: 'exact', head: true });
  console.log(`\nHistorical Scores: ${historyCount?.toLocaleString()}`);

  // Sample top scores
  console.log('\nTop 5 Market Health Scores:');
  const { data: topScores } = await supabase
    .from('propertyiq_scores')
    .select('geography_name, geography_type, market_health_score, homeready_score, investoredge_score')
    .order('market_health_score', { ascending: false })
    .limit(5);

  if (topScores) {
    for (const s of topScores) {
      console.log(`  ${s.market_health_score} - ${s.geography_name} (${s.geography_type})`);
    }
  }

  // Check date range in history
  console.log('\nHistorical Date Range:');
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

  console.log(`  From: ${minDate?.[0]?.period_date}`);
  console.log(`  To: ${maxDate?.[0]?.period_date}`);

  console.log('\n✓ Verification complete');
}

main();
