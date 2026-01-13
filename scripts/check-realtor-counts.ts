/**
 * Check Realtor table record counts
 */
import { createClient } from '@supabase/supabase-js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../packages/frontend/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('Checking Realtor table counts...\n');

  // Check each table
  const tables = ['realtor_state', 'realtor_metro', 'realtor_county', 'realtor_zip'];

  for (const table of tables) {
    // Get latest date
    const { data: dates } = await supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    const latestDate = dates?.[0]?.period_date;

    // Count for latest date
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('period_date', latestDate);

    if (error) {
      console.log(`${table}: ERROR - ${error.message}`);
    } else {
      console.log(`${table}: ${count} records (date: ${latestDate})`);
    }
  }
}

main().catch(console.error);
