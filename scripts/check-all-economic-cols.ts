/**
 * Check all columns in economic tables for income data
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking all economic table columns...\n');

  // Check economic_metro
  const { data: metro } = await supabase.from('economic_metro').select('*').limit(1);
  if (metro && metro[0]) {
    console.log('economic_metro columns:');
    for (const [key, val] of Object.entries(metro[0])) {
      console.log(`  ${key}: ${val}`);
    }
  }

  console.log('\n---\n');

  // Check economic_state
  const { data: state } = await supabase.from('economic_state').select('*').limit(1);
  if (state && state[0]) {
    console.log('economic_state columns:');
    for (const [key, val] of Object.entries(state[0])) {
      console.log(`  ${key}: ${val}`);
    }
  }

  console.log('\n---\n');

  // Check economic_county
  const { data: county } = await supabase.from('economic_county').select('*').limit(1);
  if (county && county[0]) {
    console.log('economic_county columns:');
    for (const [key, val] of Object.entries(county[0])) {
      console.log(`  ${key}: ${val}`);
    }
  }

  console.log('\n---\n');

  // Check economic_national
  const { data: national } = await supabase.from('economic_national').select('*').limit(1);
  if (national && national[0]) {
    console.log('economic_national columns:');
    for (const [key, val] of Object.entries(national[0])) {
      console.log(`  ${key}: ${val}`);
    }
  }
}

check().catch(console.error);
