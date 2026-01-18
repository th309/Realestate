/**
 * Run refresh-calculated-metrics directly
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { refreshCalculatedMetrics } from './utils/refresh-calculated-metrics';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('Running calculated metrics refresh...\n');
  const result = await refreshCalculatedMetrics(supabase);
  console.log('\nResult:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
