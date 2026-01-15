#!/usr/bin/env npx tsx
/**
 * Fix Missing CBSA Codes in zillow_metro Table
 *
 * Updates records with NULL cbsa_code by matching region_name to the crosswalk.
 * Uses name-based fuzzy matching to find CBSA codes for metros that weren't
 * matched by region_id.
 *
 * Usage:
 *   npx tsx scripts/fix-missing-cbsa-codes.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Name-based crosswalk maps
const cbsaNameMap: Map<string, string> = new Map();

/**
 * Normalize metro name for fuzzy matching
 */
function normalizeMetroName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,\-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract primary metro name (before comma)
 */
function extractPrimaryMetroName(name: string): string {
  const parts = name.split(',');
  return parts[0].toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

async function loadCbsaCrosswalk(): Promise<void> {
  console.log('Loading CBSA crosswalk...');

  const { data, error } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, zillow_region_name, cbsa_code, cbsa_title');

  if (error) {
    console.error('Error loading crosswalk:', error.message);
    return;
  }

  if (data) {
    for (const row of data) {
      if (row.cbsa_code) {
        // Map by normalized Zillow region name
        if (row.zillow_region_name) {
          const normalizedZillow = normalizeMetroName(row.zillow_region_name);
          if (!cbsaNameMap.has(normalizedZillow)) {
            cbsaNameMap.set(normalizedZillow, row.cbsa_code);
          }
          const primaryZillow = extractPrimaryMetroName(row.zillow_region_name);
          if (!cbsaNameMap.has(primaryZillow)) {
            cbsaNameMap.set(primaryZillow, row.cbsa_code);
          }
        }

        // Map by normalized CBSA title
        if (row.cbsa_title) {
          const normalizedCbsa = normalizeMetroName(row.cbsa_title);
          if (!cbsaNameMap.has(normalizedCbsa)) {
            cbsaNameMap.set(normalizedCbsa, row.cbsa_code);
          }
          const primaryCbsa = extractPrimaryMetroName(row.cbsa_title);
          if (!cbsaNameMap.has(primaryCbsa)) {
            cbsaNameMap.set(primaryCbsa, row.cbsa_code);
          }
        }
      }
    }
    console.log(`Loaded ${cbsaNameMap.size} name-based CBSA mappings`);
  }
}

async function findMissingCbsaCodes(): Promise<void> {
  console.log('\nFinding records with missing cbsa_code...');

  // Get distinct region_names without cbsa_code
  const { data: missingRecords, error } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name')
    .is('cbsa_code', null)
    .limit(5000);

  if (error) {
    console.error('Error finding missing records:', error.message);
    return;
  }

  if (!missingRecords || missingRecords.length === 0) {
    console.log('No records with missing cbsa_code found!');
    return;
  }

  // Get unique region_ids and names
  const uniqueMetros = new Map<string, string>();
  for (const record of missingRecords) {
    if (record.region_id && record.region_name && !uniqueMetros.has(record.region_id)) {
      uniqueMetros.set(record.region_id, record.region_name);
    }
  }

  console.log(`Found ${uniqueMetros.size} unique metros with missing cbsa_code`);

  // Try to match each one
  let matched = 0;
  let unmatched = 0;
  const unmatchedNames: string[] = [];

  for (const [regionId, regionName] of uniqueMetros) {
    // Try name-based matching
    let cbsaCode = cbsaNameMap.get(normalizeMetroName(regionName))
      || cbsaNameMap.get(extractPrimaryMetroName(regionName));

    if (cbsaCode) {
      // Update all records with this region_id
      const { error: updateError, count } = await supabase
        .from('zillow_metro')
        .update({ cbsa_code: cbsaCode })
        .eq('region_id', regionId)
        .is('cbsa_code', null);

      if (updateError) {
        console.error(`Error updating ${regionName}: ${updateError.message}`);
      } else {
        matched++;
        console.log(`✅ ${regionName} -> ${cbsaCode}`);
      }
    } else {
      unmatched++;
      unmatchedNames.push(regionName);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Matched: ${matched}`);
  console.log(`Unmatched: ${unmatched}`);

  if (unmatchedNames.length > 0) {
    console.log('\nUnmatched metros (could not find CBSA code):');
    unmatchedNames.forEach(name => console.log(`  - ${name}`));
  }
}

async function getCounts(): Promise<void> {
  console.log('\n=== CBSA CODE COVERAGE ===');

  const { count: total } = await supabase
    .from('zillow_metro')
    .select('region_id', { count: 'exact', head: true });

  const { count: withCbsa } = await supabase
    .from('zillow_metro')
    .select('region_id', { count: 'exact', head: true })
    .not('cbsa_code', 'is', null);

  const { count: withoutCbsa } = await supabase
    .from('zillow_metro')
    .select('region_id', { count: 'exact', head: true })
    .is('cbsa_code', null);

  console.log(`Total records: ${total}`);
  console.log(`With cbsa_code: ${withCbsa}`);
  console.log(`Without cbsa_code: ${withoutCbsa}`);
  console.log(`Coverage: ${total && withCbsa ? ((withCbsa / total) * 100).toFixed(2) : 0}%`);
}

async function main() {
  console.log('=== Fix Missing CBSA Codes ===\n');

  await loadCbsaCrosswalk();
  await findMissingCbsaCodes();
  await getCounts();

  console.log('\nDone!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
