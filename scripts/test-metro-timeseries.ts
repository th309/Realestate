import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function test() {
  console.log('Testing metro timeseries queries...\n');

  // Test queries that would come from frontend
  const testCases = [
    { metro: 'Chicago', expected: 'Chicago-Naperville-Elgin' },
    { metro: 'New York', expected: 'New York-Newark-Jersey City' },
    { metro: 'Los Angeles', expected: 'Los Angeles-Long Beach-Anaheim' },
  ];

  for (const { metro, expected } of testCases) {
    console.log(`=== Testing "${metro}" ===`);

    // Realtor table with ILIKE (new approach)
    const { data, count } = await supabase
      .from('realtor_metro')
      .select('cbsa_code, cbsa_title, median_listing_price, period_date', { count: 'exact' })
      .ilike('cbsa_title', `${metro}%`)
      .order('period_date', { ascending: false })
      .limit(3);

    console.log(`  Query: cbsa_title ILIKE '${metro}%'`);
    console.log(`  Rows found: ${count}`);
    if (data && data[0]) {
      console.log(`  Matched: ${data[0].cbsa_title}`);
      console.log(`  Latest price: $${data[0].median_listing_price?.toLocaleString()}`);
    } else {
      console.log(`  ❌ NO DATA FOUND`);
    }
    console.log('');
  }
}

test().catch(console.error);
