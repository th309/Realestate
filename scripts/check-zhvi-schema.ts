import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSchema() {
  // Get table columns
  const { data: columns } = await supabase
    .from('zillow_zhvi')
    .select('*')
    .limit(1);

  console.log('Sample record columns:', Object.keys(columns?.[0] || {}));

  // Check indexes via a direct query - this won't work via Supabase client
  // but we can infer from the existing data
  const { data: sample } = await supabase
    .from('zillow_zhvi')
    .select('id, region_id, date, property_type, tier, geography')
    .eq('geography', 'Metro')
    .limit(5);

  console.log('\nSample Metro records:', sample);
}

checkSchema().catch(console.error);
