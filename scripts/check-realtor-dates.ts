/**
 * Check available dates in Realtor tables
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkDates() {
  console.log('Checking Realtor table dates...\n');

  // Check how JavaScript parses the dates
  const dateStr = '2025-12-01';
  const targetDate = new Date(dateStr);
  console.log('Parsing "2025-12-01":');
  console.log('  targetDate:', targetDate.toISOString());
  console.log('  Local - getFullYear():', targetDate.getFullYear());
  console.log('  Local - getMonth() + 1:', targetDate.getMonth() + 1);
  console.log('  Local - getDate():', targetDate.getDate());
  console.log('  UTC   - getUTCFullYear():', targetDate.getUTCFullYear());
  console.log('  UTC   - getUTCMonth() + 1:', targetDate.getUTCMonth() + 1);
  console.log('  UTC   - getUTCDate():', targetDate.getUTCDate());

  // Build the date string like the service does (with UTC fix)
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth() + 1;
  const targetDay = targetDate.getUTCDate();

  console.log('\nDates the service would look for:');
  for (let i = 1; i <= 5; i++) {
    const year = targetYear - i;
    const month = String(targetMonth).padStart(2, '0');
    const day = String(targetDay).padStart(2, '0');
    const lookupDate = `${year}-${month}-${day}`;
    console.log(`  Year -${i}: ${lookupDate}`);
  }

  // Check specific December dates we're looking for
  const datesToCheck = [
    '2025-12-01',
    '2024-12-01',
    '2023-12-01',
    '2022-12-01',
    '2021-12-01',
    '2020-12-01',
  ];

  console.log('\nActual records in database:');
  for (const dateStr of datesToCheck) {
    const { data, count } = await supabase
      .from('realtor_metro')
      .select('cbsa_code', { count: 'exact' })
      .eq('period_date', dateStr)
      .limit(1);

    console.log(`  ${dateStr}: ${count || 0} records`);
  }
}

checkDates().catch(console.error);
