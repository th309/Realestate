import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Count total markets
  const { count } = await supabase.from('markets').select('*', { count: 'exact', head: true });
  console.log('Total markets:', count?.toLocaleString());

  // Check region types
  const { data: msa } = await supabase.from('markets').select('*', { count: 'exact', head: true }).eq('region_type', 'msa');
  const { data: state } = await supabase.from('markets').select('*', { count: 'exact', head: true }).eq('region_type', 'state');
  const { data: county } = await supabase.from('markets').select('*', { count: 'exact', head: true }).eq('region_type', 'county');
  const { data: city } = await supabase.from('markets').select('*', { count: 'exact', head: true }).eq('region_type', 'city');
  const { data: zip } = await supabase.from('markets').select('*', { count: 'exact', head: true }).eq('region_type', 'zip');

  // Get counts properly
  const { count: msaCount } = await supabase.from('markets').select('*', { count: 'exact', head: true }).eq('region_type', 'msa');
  const { count: stateCount } = await supabase.from('markets').select('*', { count: 'exact', head: true }).eq('region_type', 'state');
  const { count: countyCount } = await supabase.from('markets').select('*', { count: 'exact', head: true }).eq('region_type', 'county');
  const { count: cityCount } = await supabase.from('markets').select('*', { count: 'exact', head: true }).eq('region_type', 'city');
  const { count: zipCount } = await supabase.from('markets').select('*', { count: 'exact', head: true }).eq('region_type', 'zip');

  console.log('\nBy region_type:');
  console.log('  MSA:', msaCount?.toLocaleString());
  console.log('  State:', stateCount?.toLocaleString());
  console.log('  County:', countyCount?.toLocaleString());
  console.log('  City:', cityCount?.toLocaleString());
  console.log('  ZIP:', zipCount?.toLocaleString());

  // Sample a few
  const { data: sample } = await supabase.from('markets').select('region_id, region_name, region_type, state_name').limit(10);
  console.log('\nSample markets:');
  sample?.forEach(m => console.log(`  ${m.region_id}: ${m.region_name} (${m.region_type})`));
}

check().catch(console.error);
