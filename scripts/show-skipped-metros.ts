import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I'
);

const ZILLOW_CSV_BASE = 'https://files.zillowstatic.com/research/public_csvs';

async function showSkipped() {
  console.log('Loading crosswalk...');
  const { data: crosswalk } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, cbsa_code, zillow_region_name')
    .limit(10000);

  const crosswalkById = new Map<string, string>();
  crosswalk?.forEach(r => {
    if (r.zillow_region_id && r.cbsa_code) {
      crosswalkById.set(String(r.zillow_region_id), r.cbsa_code);
    }
  });

  console.log(`Crosswalk has ${crosswalkById.size} entries\n`);

  // Download and check SFR
  console.log('Downloading SFR CSV...');
  const sfrResponse = await fetch(`${ZILLOW_CSV_BASE}/zori/Metro_zori_uc_sfr_sm_month.csv`);
  const sfrCsv = await sfrResponse.text();
  const sfrRows = parse(sfrCsv, { columns: true, skip_empty_lines: true });

  console.log('='.repeat(60));
  console.log('SKIPPED SFR METROS (no CBSA in crosswalk):');
  console.log('='.repeat(60));

  let sfrSkipped = 0;
  for (const row of sfrRows) {
    const regionId = String(row['RegionID']);
    const regionName = row['RegionName'];

    if (!crosswalkById.has(regionId)) {
      sfrSkipped++;
      console.log(`  ${regionId}: ${regionName}`);
    }
  }
  console.log(`\nTotal SFR skipped: ${sfrSkipped}`);

  // Download and check MFR
  console.log('\nDownloading MFR CSV...');
  const mfrResponse = await fetch(`${ZILLOW_CSV_BASE}/zori/Metro_zori_uc_mfr_sm_month.csv`);
  const mfrCsv = await mfrResponse.text();
  const mfrRows = parse(mfrCsv, { columns: true, skip_empty_lines: true });

  console.log('\n' + '='.repeat(60));
  console.log('SKIPPED MFR METROS (no CBSA in crosswalk):');
  console.log('='.repeat(60));

  let mfrSkipped = 0;
  for (const row of mfrRows) {
    const regionId = String(row['RegionID']);
    const regionName = row['RegionName'];

    if (!crosswalkById.has(regionId)) {
      mfrSkipped++;
      console.log(`  ${regionId}: ${regionName}`);
    }
  }
  console.log(`\nTotal MFR skipped: ${mfrSkipped}`);
}

showSkipped().catch(e => console.error('Error:', e));
