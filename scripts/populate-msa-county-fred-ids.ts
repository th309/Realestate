/**
 * Populate MSA and County FRED Series IDs
 * 
 * This script populates FRED series IDs for MSA and County levels using:
 * 1. Known consistent patterns (e.g., GDP: NGMP{CBSA_CODE})
 * 2. API discovery for patterns that vary
 * 3. Manual CSV import for remaining
 * 
 * Usage:
 *   npx tsx scripts/populate-msa-county-fred-ids.ts --geography=msa --pattern=gdp
 *   npx tsx scripts/populate-msa-county-fred-ids.ts --geography=msa --all
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../web/.env.local') });

const FRED_API_KEY = process.env.FRED_API_KEY || '';
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

if (!FRED_API_KEY) {
  console.error('❌ Error: Missing FRED_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function verifySeriesId(seriesId: string): Promise<boolean> {
  try {
    const url = `${FRED_BASE_URL}/series?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json`;
    const response = await fetch(url);
    if (!response.ok) return false;
    const data = await response.json();
    return !data.error_code && data.seriess && data.seriess.length > 0;
  } catch {
    return false;
  }
}

async function populateMSAGDP() {
  console.log('\n📊 Populating MSA GDP Series IDs (Pattern: NGMP{CBSA_CODE})...\n');

  const { data: msas, error } = await supabase
    .from('tiger_cbsa')
    .select('geoid, name')
    .eq('lsad', 'M1')
    .is('fred_gdp_series_id', null);

  if (error) {
    console.error(`❌ Error: ${error.message}`);
    return;
  }

  let updated = 0;
  let verified = 0;

  for (const msa of msas || []) {
    const seriesId = `NGMP${msa.geoid}`;
    const isValid = await verifySeriesId(seriesId);

    if (isValid) {
      // Use exec_sql RPC to bypass RLS
      const updateSql = `
        UPDATE tiger_cbsa 
        SET fred_gdp_series_id = '${seriesId.replace(/'/g, "''")}'
        WHERE geoid = '${msa.geoid.replace(/'/g, "''")}'
      `;

      const { error: updateError } = await supabase.rpc('exec_sql', { query: updateSql });

      if (!updateError) {
        console.log(`   ✅ ${msa.name} (${msa.geoid}): ${seriesId}`);
        updated++;
        verified++;
      } else {
        console.log(`   ⚠️  ${msa.name}: Update failed - ${updateError.message}`);
      }
    } else {
      console.log(`   ❌ ${msa.name} (${msa.geoid}): ${seriesId} - Invalid`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n✅ Updated ${updated} MSAs with verified GDP series IDs`);
  return { updated, verified };
}

async function populateMSAFromDiscovery() {
  console.log('\n📊 Populating MSA Series IDs from Discovery Results...\n');
  console.log('⚠️  This requires running discover-msa-county-fred-ids.ts first and importing results');
  console.log('⚠️  For now, using known patterns where possible\n');

  // For unemployment and employment, we'll need to use the discovery script results
  // For now, we'll document the pattern and let users run discovery
  console.log('💡 To populate unemployment_rate and employment_total:');
  console.log('   1. Run: npx tsx scripts/discover-msa-county-fred-ids.ts --geography=msa --limit=1000');
  console.log('   2. Review the CSV output');
  console.log('   3. Import verified series IDs using the update_fred_series_id() function');
}

async function populateCountyFromDiscovery() {
  console.log('\n📊 Populating County Series IDs from Discovery Results...\n');
  console.log('⚠️  County series IDs require API discovery due to inconsistent patterns\n');

  console.log('💡 To populate county series IDs:');
  console.log('   1. Run: npx tsx scripts/discover-msa-county-fred-ids.ts --geography=county --limit=100');
  console.log('   2. Review the CSV output');
  console.log('   3. Import verified series IDs using the update_fred_series_id() function');
}

async function syncToGeographicUnits() {
  console.log('\n🔄 Syncing MSA FRED Series IDs to geographic_units...\n');

  const sql = `
    UPDATE geographic_units gu
    SET 
      fred_unemployment_rate_series_id = cbsa.fred_unemployment_rate_series_id,
      fred_employment_total_series_id = cbsa.fred_employment_total_series_id,
      fred_median_household_income_series_id = cbsa.fred_median_household_income_series_id,
      fred_gdp_series_id = cbsa.fred_gdp_series_id,
      fred_housing_permits_series_id = cbsa.fred_housing_permits_series_id
    FROM tiger_cbsa cbsa
    WHERE gu.geoid = cbsa.geoid
    AND gu.level = 'cbsa'
    AND (
      cbsa.fred_unemployment_rate_series_id IS NOT NULL
      OR cbsa.fred_employment_total_series_id IS NOT NULL
      OR cbsa.fred_median_household_income_series_id IS NOT NULL
      OR cbsa.fred_gdp_series_id IS NOT NULL
      OR cbsa.fred_housing_permits_series_id IS NOT NULL
    );
  `;

  const { error } = await supabase.rpc('exec_sql', { query: sql });

  if (error) {
    console.error(`❌ Error syncing: ${error.message}`);
  } else {
    console.log('✅ Synced MSA series IDs to geographic_units');
  }

  // Sync counties
  const countySql = `
    UPDATE geographic_units gu
    SET 
      fred_unemployment_rate_series_id = county.fred_unemployment_rate_series_id,
      fred_employment_total_series_id = county.fred_employment_total_series_id,
      fred_median_household_income_series_id = county.fred_median_household_income_series_id
    FROM tiger_counties county
    WHERE gu.geoid = county.geoid
    AND gu.level = 'county'
    AND (
      county.fred_unemployment_rate_series_id IS NOT NULL
      OR county.fred_employment_total_series_id IS NOT NULL
      OR county.fred_median_household_income_series_id IS NOT NULL
    );
  `;

  const { error: countyError } = await supabase.rpc('exec_sql', { query: countySql });

  if (countyError) {
    console.error(`❌ Error syncing counties: ${countyError.message}`);
  } else {
    console.log('✅ Synced County series IDs to geographic_units');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const geography = args.find(arg => arg.startsWith('--geography='))?.split('=')[1];
  const pattern = args.find(arg => arg.startsWith('--pattern='))?.split('=')[1];
  const all = args.includes('--all');
  const sync = args.includes('--sync');

  console.log('🔧 FRED Series ID Population Tool\n');

  if (pattern === 'gdp' && geography === 'msa') {
    await populateMSAGDP();
  } else if (all && geography === 'msa') {
    await populateMSAGDP();
    await populateMSAFromDiscovery();
  } else if (geography === 'county') {
    await populateCountyFromDiscovery();
  } else {
    console.log('Usage:');
    console.log('  npx tsx scripts/populate-msa-county-fred-ids.ts --geography=msa --pattern=gdp');
    console.log('  npx tsx scripts/populate-msa-county-fred-ids.ts --geography=msa --all');
    console.log('  npx tsx scripts/populate-msa-county-fred-ids.ts --geography=county');
    console.log('  npx tsx scripts/populate-msa-county-fred-ids.ts --sync');
    process.exit(1);
  }

  if (sync || all) {
    await syncToGeographicUnits();
  }
}

main().catch(console.error);

