/**
 * Debug extreme cap rate values
 * Check source data that's causing invalid calculations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         EXTREME CAP RATE INVESTIGATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check Todd County (46121) - 386640% cap rate
  console.log('📊 1. INVESTIGATING TODD COUNTY (46121)');
  console.log('───────────────────────────────────────────────────────────────');

  const toddFips = '46121';

  // Get Census rent data
  const { data: toddCensus } = await supabase
    .from('census_county')
    .select('fips_code, county_name, median_gross_rent, year')
    .eq('fips_code', toddFips);

  console.log('\n  Census county data for Todd County:');
  console.log(JSON.stringify(toddCensus, null, 2));

  // Get Realtor price data
  const { data: toddRealtor } = await supabase
    .from('realtor_county')
    .select('county_fips, county_name, median_listing_price, period_date')
    .eq('county_fips', toddFips)
    .order('period_date', { ascending: false })
    .limit(3);

  console.log('\n  Realtor data for Todd County:');
  console.log(JSON.stringify(toddRealtor, null, 2));

  // Check calculated metric record
  const { data: toddCalc } = await supabase
    .from('calculated_metrics')
    .select('*')
    .eq('geography_id', toddFips)
    .eq('geography_type', 'county');

  console.log('\n  Calculated metrics for Todd County:');
  console.log(JSON.stringify(toddCalc, null, 2));

  // Check ZIP 50104 - 594000% cap rate
  console.log('\n\n📊 2. INVESTIGATING ZIP 50104');
  console.log('───────────────────────────────────────────────────────────────');

  const zip50104 = '50104';

  // Get Census rent data
  const { data: zipCensus } = await supabase
    .from('census_zip')
    .select('zcta, median_gross_rent, year')
    .eq('zcta', zip50104);

  console.log('\n  Census ZIP data:');
  console.log(JSON.stringify(zipCensus, null, 2));

  // Get Realtor price data
  const { data: zipRealtor } = await supabase
    .from('realtor_zip')
    .select('postal_code, zip_name, median_listing_price, period_date')
    .eq('postal_code', zip50104)
    .order('period_date', { ascending: false })
    .limit(3);

  console.log('\n  Realtor ZIP data:');
  console.log(JSON.stringify(zipRealtor, null, 2));

  // Check ZIP 94037 - negative cap rate (-343347%)
  console.log('\n\n📊 3. INVESTIGATING ZIP 94037 (NEGATIVE CAP RATE)');
  console.log('───────────────────────────────────────────────────────────────');

  const zip94037 = '94037';

  const { data: negZipCensus } = await supabase
    .from('census_zip')
    .select('zcta, median_gross_rent, year')
    .eq('zcta', zip94037);

  console.log('\n  Census ZIP data for 94037:');
  console.log(JSON.stringify(negZipCensus, null, 2));

  const { data: negZipRealtor } = await supabase
    .from('realtor_zip')
    .select('postal_code, zip_name, median_listing_price, period_date')
    .eq('postal_code', zip94037)
    .order('period_date', { ascending: false })
    .limit(3);

  console.log('\n  Realtor ZIP data for 94037:');
  console.log(JSON.stringify(negZipRealtor, null, 2));

  const { data: negZipCalc } = await supabase
    .from('calculated_metrics')
    .select('*')
    .eq('geography_id', zip94037)
    .eq('geography_type', 'zip');

  console.log('\n  Calculated metrics for ZIP 94037:');
  console.log(JSON.stringify(negZipCalc, null, 2));

  // Check what percentage of records have extreme values
  console.log('\n\n📊 4. COUNT OF EXTREME VALUES');
  console.log('───────────────────────────────────────────────────────────────');

  const { count: extremeHigh } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .not('cap_rate', 'is', null)
    .gt('cap_rate', 15);

  const { count: extremeLow } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .not('cap_rate', 'is', null)
    .lt('cap_rate', 0);

  const { count: negativeRents } = await supabase
    .from('census_county')
    .select('*', { count: 'exact', head: true })
    .lt('median_gross_rent', 0);

  const { count: negativeRentsZip } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .lt('median_gross_rent', 0);

  console.log(`  Cap rates > 15%: ${extremeHigh}`);
  console.log(`  Cap rates < 0%: ${extremeLow}`);
  console.log(`  Census county records with negative rent: ${negativeRents}`);
  console.log(`  Census ZIP records with negative rent: ${negativeRentsZip}`);

  // Check typical Census rent values
  console.log('\n\n📊 5. TYPICAL CENSUS RENT VALUES');
  console.log('───────────────────────────────────────────────────────────────');

  const { data: typicalRents } = await supabase
    .from('census_county')
    .select('fips_code, county_name, median_gross_rent')
    .gt('median_gross_rent', 0)
    .lt('median_gross_rent', 5000)  // Normal monthly rents
    .order('median_gross_rent', { ascending: false })
    .limit(10);

  console.log('\n  Sample of normal Census county rents:');
  for (const r of typicalRents || []) {
    console.log(`    ${r.county_name}: $${r.median_gross_rent}/month`);
  }

  const { data: veryHighRents } = await supabase
    .from('census_county')
    .select('fips_code, county_name, median_gross_rent')
    .gt('median_gross_rent', 5000)
    .order('median_gross_rent', { ascending: false })
    .limit(10);

  console.log('\n  Counties with rent > $5000 (suspicious):');
  for (const r of veryHighRents || []) {
    console.log(`    ${r.county_name} (${r.fips_code}): $${r.median_gross_rent}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('         INVESTIGATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
