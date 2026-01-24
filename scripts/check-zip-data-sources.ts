import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking ZIP data sources...\n');

  // realtor_zip
  try {
    const { count } = await supabase.from('realtor_zip').select('*', { count: 'exact', head: true });
    console.log('realtor_zip:', count, 'total rows');

    // Check unique postal codes
    const { data: sample } = await supabase.from('realtor_zip')
      .select('postal_code, state_id')
      .limit(5);
    console.log('  Sample:', sample?.map(r => `${r.postal_code} (${r.state_id})`).join(', '));

    // CA count
    const { count: caCount } = await supabase.from('realtor_zip')
      .select('*', { count: 'exact', head: true })
      .eq('state_id', 'CA');
    console.log('  CA rows:', caCount);
  } catch (e: any) {
    console.log('realtor_zip: error -', e.message);
  }

  // zillow_zip
  try {
    const { count } = await supabase.from('zillow_zip').select('*', { count: 'exact', head: true });
    console.log('\nzillow_zip:', count, 'total rows');

    // Check structure
    const { data: sample } = await supabase.from('zillow_zip')
      .select('region_id, region_name, state_code')
      .limit(5);
    console.log('  Sample:', sample?.map(r => `${r.region_name} (${r.state_code})`).join(', '));

    // CA count
    const { count: caCount } = await supabase.from('zillow_zip')
      .select('*', { count: 'exact', head: true })
      .eq('state_code', 'CA');
    console.log('  CA rows:', caCount);
  } catch (e: any) {
    console.log('zillow_zip: error -', e.message);
  }

  // census_zip
  try {
    const { count } = await supabase.from('census_zip').select('*', { count: 'exact', head: true });
    console.log('\ncensus_zip:', count, 'total rows');

    // CA count
    const { count: caCount } = await supabase.from('census_zip')
      .select('*', { count: 'exact', head: true })
      .eq('state_fips', '06');
    console.log('  CA rows:', caCount);
  } catch (e: any) {
    console.log('census_zip: error -', e.message);
  }

  // hud_fmr_zip
  try {
    const { count } = await supabase.from('hud_fmr_zip').select('*', { count: 'exact', head: true });
    console.log('\nhud_fmr_zip:', count, 'total rows');
  } catch (e: any) {
    console.log('hud_fmr_zip: error -', e.message);
  }

  // geographies table - ZIP level
  try {
    const { count } = await supabase.from('geographies')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', 'zip');
    console.log('\ngeographies (zip type):', count, 'total rows');

    // CA count
    const { count: caCount } = await supabase.from('geographies')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', 'zip')
      .eq('state_code', 'CA');
    console.log('  CA rows:', caCount);
  } catch (e: any) {
    console.log('geographies (zip): error -', e.message);
  }

  // Check how many unique CA ZIPs in GeoJSON (using RPC)
  try {
    const { data } = await supabase.rpc('get_zcta_geojson_by_state', { p_state_abbrev: 'CA' });
    const featureCount = data?.features?.length || 0;
    console.log('\nGeoJSON CA ZCTAs (from RPC):', featureCount);
  } catch (e: any) {
    console.log('GeoJSON RPC: error -', e.message);
  }
}

check().catch(console.error);
