/**
 * Refresh All Calculated Metrics - Standalone Runner
 *
 * Runs the refreshCalculatedMetrics utility to update all derived metrics
 * including income_to_buy for all geographies.
 *
 * Usage: npx tsx scripts/refresh-all-metrics.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { refreshCalculatedMetrics } from './utils/refresh-calculated-metrics';

// Load env files
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         REFRESH ALL CALCULATED METRICS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');

  const result = await refreshCalculatedMetrics(supabase);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                       SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Investment Metrics: ${result.investmentMetrics.stored} stored`);
  console.log(`Overvalued %:       ${result.overvalued.stored} stored`);
  console.log(`5-yr Growth Metros: ${result.growth5YrMetros.stored} stored`);
  console.log(`5-yr Growth States: ${result.growth5YrStates.stored} stored`);
  console.log('');
  console.log('Income-to-Buy by Geography:');
  for (const [geoType, data] of Object.entries(result.incomeToBuy.byGeo)) {
    console.log(`  ${geoType.padEnd(10)}: ${data.stored} stored`);
  }
  console.log('');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`TOTAL: ${result.totalStored} records in ${(result.duration / 1000).toFixed(1)}s`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
