import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  // Zillow tables
  const { data: zCounty } = await supabase.from('zillow_county').select('*').eq('metric_name', 'zori').limit(1);
  console.log('zillow_county columns:', zCounty?.[0] ? Object.keys(zCounty[0]) : 'no data');

  const { data: zZip } = await supabase.from('zillow_zip').select('*').eq('metric_name', 'zori').limit(1);
  console.log('zillow_zip columns:', zZip?.[0] ? Object.keys(zZip[0]) : 'no data');
  console.log('zillow_zip sample - region_name is ZIP:', zZip?.[0]?.region_name);

  // Realtor tables
  const { data: rCounty } = await supabase.from('realtor_county').select('*').limit(1);
  console.log('\nrealtor_county columns:', rCounty?.[0] ? Object.keys(rCounty[0]) : 'no data');

  const { data: rZip } = await supabase.from('realtor_zip').select('*').limit(1);
  console.log('realtor_zip columns:', rZip?.[0] ? Object.keys(rZip[0]) : 'no data');
}

check().catch(console.error);
