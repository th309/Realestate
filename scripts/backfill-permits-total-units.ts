/**
 * Backfill null total_units in permits tables using Supabase client API
 * This calculates total_units from: sf + duplex + small_multi + large_multi
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or service key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BATCH_SIZE = 500;

interface PermitRow {
  id: number;
  sf_units: number | null;
  duplex_units: number | null;
  small_multi_units: number | null;
  large_multi_units: number | null;
  total_units: number | null;
  sf_buildings: number | null;
  duplex_buildings: number | null;
  small_multi_buildings: number | null;
  large_multi_buildings: number | null;
  total_buildings: number | null;
  sf_value: number | null;
  duplex_value: number | null;
  small_multi_value: number | null;
  large_multi_value: number | null;
  total_value: number | null;
}

async function backfillTable(tableName: string) {
  console.log(`\nProcessing ${tableName}...`);

  // Get count of rows with null total_units
  const { count: nullCount } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .is('total_units', null);

  console.log(`  Found ${nullCount ?? 0} rows with null total_units`);

  if (!nullCount || nullCount === 0) {
    console.log(`  Nothing to update`);
    return;
  }

  let offset = 0;
  let totalUpdated = 0;

  while (true) {
    // Fetch batch of rows with null total_units
    const { data: rows, error: fetchError } = await supabase
      .from(tableName)
      .select('id, sf_units, duplex_units, small_multi_units, large_multi_units, total_units, sf_buildings, duplex_buildings, small_multi_buildings, large_multi_buildings, total_buildings, sf_value, duplex_value, small_multi_value, large_multi_value, total_value')
      .is('total_units', null)
      .range(0, BATCH_SIZE - 1); // Always start from 0 since we're filtering by null

    if (fetchError) {
      console.error(`  Error fetching: ${fetchError.message}`);
      break;
    }

    if (!rows || rows.length === 0) {
      break;
    }

    console.log(`  Processing batch of ${rows.length} rows...`);

    // Update each row
    for (const row of rows as PermitRow[]) {
      const totalUnits = (row.sf_units ?? 0) + (row.duplex_units ?? 0) + (row.small_multi_units ?? 0) + (row.large_multi_units ?? 0);
      const totalBuildings = (row.sf_buildings ?? 0) + (row.duplex_buildings ?? 0) + (row.small_multi_buildings ?? 0) + (row.large_multi_buildings ?? 0);
      const totalValue = (row.sf_value ?? 0) + (row.duplex_value ?? 0) + (row.small_multi_value ?? 0) + (row.large_multi_value ?? 0);

      const updates: Record<string, number> = {};

      if (row.total_units === null) {
        updates.total_units = totalUnits;
      }
      if (row.total_buildings === null) {
        updates.total_buildings = totalBuildings;
      }
      if (row.total_value === null) {
        updates.total_value = totalValue;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from(tableName)
          .update(updates)
          .eq('id', row.id);

        if (updateError) {
          console.error(`  Error updating id ${row.id}: ${updateError.message}`);
        } else {
          totalUpdated++;
        }
      }
    }

    console.log(`  Updated ${totalUpdated} rows so far...`);

    // If we got less than batch size, we're done
    if (rows.length < BATCH_SIZE) {
      break;
    }
  }

  console.log(`  ✓ Completed: ${totalUpdated} rows updated`);
}

async function main() {
  console.log('Backfilling null total_units in permits tables...');
  console.log('This calculates: total = sf + duplex + small_multi + large_multi\n');

  // Process county table first (larger)
  await backfillTable('permits_county');

  // Process state table
  await backfillTable('permits_state');

  // Verify results
  console.log('\n--- Verification ---');

  const { count: countyNull } = await supabase
    .from('permits_county')
    .select('*', { count: 'exact', head: true })
    .is('total_units', null);

  const { count: stateNull } = await supabase
    .from('permits_state')
    .select('*', { count: 'exact', head: true })
    .is('total_units', null);

  console.log(`permits_county: ${countyNull ?? 0} rows still have null total_units`);
  console.log(`permits_state: ${stateNull ?? 0} rows still have null total_units`);

  // Sample some data
  console.log('\nSample counties with total_units = 0:');
  const { data: samples } = await supabase
    .from('permits_county')
    .select('fips_code, county_name, sf_units, large_multi_units, total_units')
    .eq('total_units', 0)
    .limit(5);

  if (samples && samples.length > 0) {
    samples.forEach(row => {
      console.log(`  ${row.fips_code} ${row.county_name}: sf=${row.sf_units}, large_mf=${row.large_multi_units}, total=${row.total_units}`);
    });
  }

  console.log('\nDone!');
}

main().catch(console.error);
