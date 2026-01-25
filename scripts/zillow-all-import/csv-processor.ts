/**
 * CSV processor for Zillow datasets
 *
 * Updated to use new long-format tables:
 * - zillow_state
 * - zillow_metro
 * - zillow_county
 * - zillow_zip
 *
 * All tables have the same structure:
 * - region_id (integer): Zillow's RegionID
 * - region_name (text): Display name
 * - state_code (text): State abbreviation
 * - period_date (date): Date of the data point
 * - metric_name (text): 'zhvi', 'zori', 'inventory', etc.
 * - value (numeric): The metric value
 */

import { parse as parseSync } from 'csv-parse/sync';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CSVImportResult, DatasetConfig } from './types';
import { getTableForGeography, getMetricName, getConflictColumns } from './db-client';
import { normalizeZipKey } from '../utils/zip';

// Global crosswalk maps for CBSA code matching
const cbsaCrosswalkMap: Map<string, string> = new Map(); // region_id -> cbsa_code
const cbsaNameMap: Map<string, string> = new Map(); // normalized_name -> cbsa_code
let crosswalkLoaded = false;

/**
 * Normalize metro name for fuzzy matching
 * "Peoria, IL" -> "peoria il"
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
 * "Peoria, IL" -> "peoria"
 */
function extractPrimaryMetroName(name: string): string {
  const parts = name.split(',');
  return parts[0].toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

/**
 * Load CBSA crosswalk from database and tiger_cbsa
 */
async function loadCbsaCrosswalk(supabase: SupabaseClient): Promise<void> {
  if (crosswalkLoaded) return;

  console.log('  📍 Loading CBSA crosswalk...');

  // Load from zillow_metro_crosswalk
  const { data, error } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, zillow_region_name, cbsa_code, cbsa_title');

  if (error) {
    console.warn(`  ⚠️ Could not load crosswalk: ${error.message}`);
  } else if (data) {
    for (const row of data) {
      if (row.zillow_region_id && row.cbsa_code) {
        cbsaCrosswalkMap.set(String(row.zillow_region_id), row.cbsa_code);

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
  }

  // Also load from tiger_cbsa for metros not in crosswalk
  const { data: tigerData, error: tigerError } = await supabase
    .from('tiger_cbsa')
    .select('geoid, name');

  if (!tigerError && tigerData) {
    for (const row of tigerData) {
      if (row.geoid && row.name) {
        const normalizedName = normalizeMetroName(row.name);
        if (!cbsaNameMap.has(normalizedName)) {
          cbsaNameMap.set(normalizedName, row.geoid);
        }
        const primaryName = extractPrimaryMetroName(row.name);
        if (!cbsaNameMap.has(primaryName)) {
          cbsaNameMap.set(primaryName, row.geoid);
        }
        // Split multi-city metros: "Dayton-Kettering-Beavercreek, OH"
        const namePart = row.name.split(',')[0];
        const cities = namePart.split('-').map((c: string) => c.toLowerCase().trim());
        for (const city of cities) {
          if (city && !cbsaNameMap.has(city)) {
            cbsaNameMap.set(city, row.geoid);
          }
        }
      }
    }
  }

  console.log(`  ✅ Loaded ${cbsaCrosswalkMap.size} CBSA mappings by region_id`);
  console.log(`  ✅ Loaded ${cbsaNameMap.size} CBSA mappings by name`);
  crosswalkLoaded = true;
}

/**
 * Look up CBSA code using crosswalk (by ID and name)
 */
function lookupCbsaCode(regionId: number, regionName: string, csvCbsaCode: string | null): string | null {
  // 1. Use CSV field if available
  if (csvCbsaCode) return csvCbsaCode;

  // 2. Look up by region_id
  const byId = cbsaCrosswalkMap.get(String(regionId));
  if (byId) return byId;

  // 3. Look up by name
  if (regionName) {
    const byNormalizedName = cbsaNameMap.get(normalizeMetroName(regionName));
    if (byNormalizedName) return byNormalizedName;

    const byPrimaryName = cbsaNameMap.get(extractPrimaryMetroName(regionName));
    if (byPrimaryName) return byPrimaryName;
  }

  return null;
}

/**
 * Build time series record for new long-format schema
 */
function buildTimeSeriesRecord(
  regionId: number,
  regionName: string,
  stateCode: string | null,
  periodDate: string,
  metricName: string,
  value: number,
  geography: string,
  extraData?: {
    cbsaCode?: string | null;
    fipsCode?: string | null;
  }
): any {
  const record: any = {
    region_id: regionId,
    region_name: regionName,
    state_code: stateCode,
    period_date: periodDate,
    metric_name: metricName,
    value: value
  };

  // Add geography-specific fields
  if (geography.toLowerCase() === 'metro' && extraData?.cbsaCode) {
    record.cbsa_code = extraData.cbsaCode;
  }
  if (geography.toLowerCase() === 'county' && extraData?.fipsCode) {
    record.fips_code = extraData.fipsCode;
  }

  return record;
}

const STATE_NAME_TO_CODE: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
  "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
  "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
  "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
  "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
  "District of Columbia": "DC"
};

/**
 * Extract state code from record
 */
function extractStateCode(record: any): string | null {
  // 1. Try explicit 'State' column (common in Metro/County files)
  if (record.State) return record.State;

  // 2. Try 'StateName' column (common in State files)
  if (record.StateName) {
    // If it's already a code (length 2), return it
    if (record.StateName.length === 2) return record.StateName;

    // Check mapping
    const code = STATE_NAME_TO_CODE[record.StateName];
    if (code) return code;
  }

  // 3. Special case for "United States"
  if (record.RegionName === "United States") return "US";

  // 4. Fallback: Check if RegionName itself is a state name
  if (record.RegionName && STATE_NAME_TO_CODE[record.RegionName]) {
    return STATE_NAME_TO_CODE[record.RegionName];
  }

  return null;
}

/**
 * Build FIPS code from state and county components
 */
function buildFipsCode(record: any): string | null {
  const stateCode = record.StateCodeFIPS;
  const countyCode = record.MunicipalCodeFIPS;
  if (stateCode && countyCode) {
    return String(stateCode).padStart(2, '0') + String(countyCode).padStart(3, '0');
  }
  return null;
}

/**
 * Import CSV data into new long-format tables
 */
export async function importCSV(
  supabase: SupabaseClient,
  csvContent: string,
  _metricName: string,  // Now derived from datasetConfig
  datasetConfig: DatasetConfig
): Promise<CSVImportResult> {
  const records: any[] = parseSync(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  let marketsCreated = 0;
  let timeSeriesInserted = 0;
  let errors = 0;

  // Get the target table based on geography
  const geography = datasetConfig.geography;
  const tableName = getTableForGeography(geography);
  const metricName = getMetricName(datasetConfig.datasetType);
  const batchSize = 50;
  const conflictColumns = getConflictColumns(tableName);

  // Load CBSA crosswalk for Metro imports
  if (geography.toLowerCase() === 'metro') {
    await loadCbsaCrosswalk(supabase);
  }

  // Collect all time series data first
  const allTimeSeriesData: any[] = [];

  for (const record of records) {
    const regionId = parseInt(record.RegionID, 10);
    let regionName = record.RegionName || '';
    if (geography.toLowerCase() === 'zip' && regionName) {
      regionName = normalizeZipKey(regionName);
    }

    if (isNaN(regionId) || !regionName) {
      continue;
    }

    const stateCode = extractStateCode(record);
    const fipsCode = buildFipsCode(record);
    // Use crosswalk lookup for CBSA code (includes name-based matching)
    const cbsaCode = lookupCbsaCode(regionId, regionName, record.CBSACode || null);

    // Extract time series data from date columns
    const dateColumns = Object.keys(record).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));

    for (const dateCol of dateColumns) {
      const value = parseFloat(record[dateCol]);
      if (isNaN(value) || value === null) continue;

      const recordData = buildTimeSeriesRecord(
        regionId,
        regionName,
        stateCode,
        dateCol,
        metricName,
        value,
        geography,
        { cbsaCode, fipsCode }
      );

      allTimeSeriesData.push(recordData);
    }

    marketsCreated++;  // Count unique regions processed
  }

  // Batch upsert time series
  console.log(`  Inserting ${allTimeSeriesData.length.toLocaleString()} records into ${tableName}...`);

  for (let i = 0; i < allTimeSeriesData.length; i += batchSize) {
    const batch = allTimeSeriesData.slice(i, i + batchSize);

    let retries = 0;
    const maxRetries = 10;
    let success = false;

    while (!success && retries < maxRetries) {
      try {
        const { error: tsError } = await supabase
          .from(tableName)
          .upsert(batch, { onConflict: conflictColumns });

        if (tsError) {
          throw new Error(tsError.message);
        }
        success = true;
        timeSeriesInserted += batch.length;
      } catch (err: any) {
        retries++;
        console.error(`\n  ⚠️ Batch error at ${i} (Attempt ${retries}/${maxRetries}): ${err.message}`);
        if (retries === 1) {
          console.log("  🔍 First record in failed batch:", JSON.stringify(batch[0]));
        }
        if (err.cause) console.error(`     Cause:`, err.cause);

        if (retries >= maxRetries) {
          console.error(`  ❌ Failed to insert batch at ${i} after ${maxRetries} attempts.`);
          errors++;
        } else {
          // Exponential backoff
          const waitTime = 1000 * Math.pow(1.5, retries);
          console.log(`     Waiting ${Math.round(waitTime)}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Progress indicator
    const progress = Math.round(((i + batch.length) / allTimeSeriesData.length) * 100);
    process.stdout.write(`\r  Progress: ${progress}%`); // New line after progress

    // Delay to prevent network congestion
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log(); // Final newline

  return { marketsCreated, timeSeriesInserted, errors };
}
