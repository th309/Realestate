import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function test() {
  console.log('Testing table access with service key...\n');

  // Test geographies
  const { data: geo, error: geoErr } = await supabase
    .from('geographies')
    .select('*')
    .limit(1);
  console.log('geographies:', geoErr ? `ERROR: ${geoErr.message}` : 'OK');

  // Test economic_metro (known working)
  const { data: eco, error: ecoErr } = await supabase
    .from('economic_metro')
    .select('*')
    .limit(1);
  console.log('economic_metro:', ecoErr ? `ERROR: ${ecoErr.message}` : 'OK');

  // Test zillow_state
  const { data: zil, error: zilErr } = await supabase
    .from('zillow_state')
    .select('*')
    .limit(1);
  console.log('zillow_state:', zilErr ? `ERROR: ${zilErr.message}` : 'OK');

  // Test markets
  const { data: mkt, error: mktErr } = await supabase
    .from('markets')
    .select('*')
    .limit(1);
  console.log('markets:', mktErr ? `ERROR: ${mktErr.message}` : 'OK');
}

test();
