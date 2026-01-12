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

/**
 * Extract state code from record
 */
function extractStateCode(record: any): string | null {
  // Try various possible fields
  if (record.State) return record.State;
  if (record.StateName) {
    // If it's a full state name, return as-is (we'll need a mapping)
    return record.StateName.length === 2 ? record.StateName : null;
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
  const batchSize = 10000;
  const conflictColumns = getConflictColumns(tableName);

  // Collect all time series data first
  const allTimeSeriesData: any[] = [];

  for (const record of records) {
    const regionId = parseInt(record.RegionID, 10);
    const regionName = record.RegionName || '';

    if (isNaN(regionId) || !regionName) {
      continue;
    }

    const stateCode = extractStateCode(record);
    const fipsCode = buildFipsCode(record);
    const cbsaCode = record.CBSACode || null;

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

    const { error: tsError } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict: conflictColumns });

    if (tsError) {
      console.error(`  Batch error at ${i}: ${tsError.message}`);
      errors++;
    } else {
      timeSeriesInserted += batch.length;
    }

    // Progress indicator
    const progress = Math.round(((i + batch.length) / allTimeSeriesData.length) * 100);
    process.stdout.write(`\r  Progress: ${progress}%`);
  }
  console.log(); // New line after progress

  return { marketsCreated, timeSeriesInserted, errors };
}
