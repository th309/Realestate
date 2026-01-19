/**
 * Check ZIP date coverage
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function check() {
  console.log('Checking ZIP income_to_buy date coverage...\n');

  // Sample dates across the expected range
  const testDates = [
    '2021-07-01', '2021-12-01',
    '2022-06-01', '2022-12-01',
    '2023-06-01', '2023-12-01',
    '2024-06-01', '2024-12-01',
    '2025-06-01', '2025-12-01'
  ];

  for (const date of testDates) {
    const { count } = await supabase
      .from('calculated_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', 'zip')
      .eq('period_date', date)
      .not('income_to_buy', 'is', null);

    console.log(`${date}: ${count || 0} ZIPs`);
  }

  // Total count
  const { count: total } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('geography_type', 'zip')
    .not('income_to_buy', 'is', null);

  console.log(`\nTotal ZIP records with income_to_buy: ${total}`);
}

check().catch(console.error);
