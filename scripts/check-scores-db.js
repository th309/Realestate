const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const trimmedLine = line.trim();
  if (trimmedLine && !trimmedLine.startsWith('#')) {
    const eqIndex = trimmedLine.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmedLine.substring(0, eqIndex).trim();
      const value = trimmedLine.substring(eqIndex + 1).trim();
      process.env[key] = value;
    }
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkScores() {
  // Check source data availability for each geography
  console.log('=== Source Data Availability ===\n');

  for (const table of ['realtor_metro', 'realtor_county', 'realtor_zip']) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(table + ': Error -', error.message);
    } else {
      console.log(table + ':', count, 'rows');
    }

    // Get latest date
    const { data: dateData } = await supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    if (dateData && dateData.length > 0) {
      console.log('  Latest date:', dateData[0].period_date);
    } else {
      console.log('  No data');
    }
  }

  console.log('\n=== PropertyIQ Scores ===\n');

  // Get total count
  const { count: totalCount } = await supabase
    .from('propertyiq_scores')
    .select('*', { count: 'exact', head: true });
  console.log('Total scores in table:', totalCount);

  // Get counts by geography type
  console.log('\nScore counts by geography type:');
  for (const geoType of ['state', 'metro', 'county', 'zip']) {
    const { count, error } = await supabase
      .from('propertyiq_scores')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geoType);

    if (error) {
      console.log(geoType + ': Error -', JSON.stringify(error));
    } else {
      console.log(geoType + ':', count, 'scores');
    }
  }

  // Get counts by score type
  console.log('\nScore counts by score type:');
  for (const scoreType of ['homeready', 'investoredge', 'markethealth']) {
    const { count, error } = await supabase
      .from('propertyiq_scores')
      .select('*', { count: 'exact', head: true })
      .eq('score_type', scoreType);

    if (error) {
      console.log(scoreType + ': Error -', JSON.stringify(error));
    } else {
      console.log(scoreType + ':', count, 'scores');
    }
  }

  console.log('\n--- Sample scores by geography ---');
  for (const geoType of ['state', 'metro', 'county', 'zip']) {
    const { data, error } = await supabase
      .from('propertyiq_scores')
      .select('location_id, location_name, score_type, score, grade, confidence, score_date')
      .eq('geography', geoType)
      .order('score_date', { ascending: false })
      .limit(6);

    if (error) {
      console.log('\n' + geoType.toUpperCase() + ': Error -', error.message);
    } else if (data && data.length > 0) {
      console.log('\n' + geoType.toUpperCase() + ' (' + data.length + ' rows):');
      data.forEach(d => console.log('  ', d.location_name, '-', d.score_type + ':', d.score, '(' + d.grade + ')', 'conf:', d.confidence, '|', d.score_date));
    } else {
      console.log('\n' + geoType.toUpperCase() + ': No data');
    }
  }
}

checkScores().catch(console.error);
