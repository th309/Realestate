/**
 * Cleanup Invalid MSA FRED Series IDs
 * 
 * Removes invalid or mismatched FRED series IDs from the database.
 * Should be run after verification to clean up any incorrect entries.
 * 
 * Usage:
 *   npx tsx scripts/cleanup-invalid-msa-fred-ids.ts --field=unemployment_rate --dry-run
 *   npx tsx scripts/cleanup-invalid-msa-fred-ids.ts --field=unemployment_rate
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

config({ path: join(__dirname, '../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function cleanupFromVerificationFile(filename: string, dryRun: boolean = true) {
  console.log(`\n🧹 Cleaning up invalid series IDs from ${filename}\n`);

  // Read verification CSV
  const csv = readFileSync(filename, 'utf-8');
  const lines = csv.split('\n').slice(1); // Skip header

  const columnMap: Record<string, string> = {
    'unemployment_rate': 'fred_unemployment_rate_series_id',
    'employment_total': 'fred_employment_total_series_id',
    'median_household_income': 'fred_median_household_income_series_id',
    'gdp': 'fred_gdp_series_id',
    'housing_permits': 'fred_housing_permits_series_id'
  };

  let cleaned = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    const [geoid, name, field, seriesId, valid, hasData, matchesMSA] = line.split(',').map(s => s.replace(/^"|"$/g, ''));

    // Only clean up if invalid, no data, or doesn't match MSA
    if (valid === 'false' || hasData === 'false' || matchesMSA === 'false') {
      const column = columnMap[field];
      if (column) {
        console.log(`   ${dryRun ? '[DRY RUN]' : ''} Removing ${field} for ${name} (${geoid}): ${seriesId}`);

        if (!dryRun) {
          const updateSql = `
            UPDATE tiger_cbsa 
            SET ${column} = NULL
            WHERE geoid = '${geoid.replace(/'/g, "''")}'
          `;

          const { error } = await supabase.rpc('exec_sql', { query: updateSql });

          if (error) {
            console.error(`      ❌ Error: ${error.message}`);
          } else {
            cleaned++;
          }
        } else {
          cleaned++;
        }
      }
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}✅ Would clean up ${cleaned} invalid series IDs`);
  if (dryRun) {
    console.log('   Run without --dry-run to actually clean up');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const filename = args.find(arg => arg.startsWith('--file='))?.split('=')[1];
  const dryRun = !args.includes('--execute');

  if (!filename) {
    console.error('❌ Error: Must provide --file=path/to/verification-results.csv');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/cleanup-invalid-msa-fred-ids.ts --file=msa-fred-ids-issues-*.csv --dry-run');
    console.log('  npx tsx scripts/cleanup-invalid-msa-fred-ids.ts --file=msa-fred-ids-issues-*.csv --execute');
    process.exit(1);
  }

  await cleanupFromVerificationFile(filename, dryRun);
}

main().catch(console.error);

