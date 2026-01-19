/**
 * Verify Income-to-Buy data was stored correctly
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         INCOME-TO-BUY DATA VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Count by geography type
  const geoTypes = ['national', 'state', 'metro', 'county', 'zip'];

  for (const geoType of geoTypes) {
    const { count } = await supabase
      .from('calculated_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', geoType)
      .not('income_to_buy', 'is', null);

    console.log(`${geoType.padEnd(10)}: ${String(count || 0).padStart(6)} records with income_to_buy`);
  }

  // Sample data by geography type
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('SAMPLE DATA');
  console.log('───────────────────────────────────────────────────────────────\n');

  for (const geoType of geoTypes) {
    const { data } = await supabase
      .from('calculated_metrics')
      .select('geography_name, income_to_buy')
      .eq('geography_type', geoType)
      .not('income_to_buy', 'is', null)
      .order('income_to_buy', { ascending: false })
      .limit(3);

    console.log(`${geoType.toUpperCase()} (Top 3 by income required):`);
    if (data) {
      for (const row of data) {
        const income = row.income_to_buy?.toLocaleString() || 'N/A';
        console.log(`  ${row.geography_name}: $${income}/year needed`);
      }
    }
    console.log('');
  }

  // Show the formula assumptions
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('CALCULATION ASSUMPTIONS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  • 20% down payment');
  console.log('  • 30-year fixed mortgage at 7% (or FRED rate if available)');
  console.log('  • 1.1% property tax rate');
  console.log('  • 0.35% insurance rate');
  console.log('  • 28% front-end DTI ratio');
  console.log('  • Formula: (Monthly PITI × 12) / 0.28 = Required Annual Income');
  console.log('═══════════════════════════════════════════════════════════════');
}

verify().catch(console.error);
