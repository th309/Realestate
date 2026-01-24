import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  const tables = ['census_metro', 'census_county', 'census_zip'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`${table}: ${error.message}`);
    } else if (data?.[0]) {
      console.log(`\n${table} columns:`, Object.keys(data[0]));
      console.log(`Sample:`, data[0]);
    }
  }
}

main().catch(console.error);
