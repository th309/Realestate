/**
 * Zillow US/Metro Dataset Importer
 */

import { parse as parseSync } from 'csv-parse/sync';
import type { DatasetConfig, ImportResult, ProcessedResult } from './types';
import { createZillowUsMetroClient } from './db-client';
import { downloadDataset } from './downloader';
import { buildRecord, getConflictColumns, getPropertyType, requiresTier } from './record-builder';

// Global crosswalk maps
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
 * Load CBSA crosswalk from database
 */
async function loadCbsaCrosswalk(): Promise<void> {
  if (crosswalkLoaded) return;

  const supabase = createZillowUsMetroClient();
  console.log('  📍 Loading CBSA crosswalk...');

  const { data, error } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, zillow_region_name, cbsa_code, cbsa_title');

  if (error) {
    console.warn(`  ⚠️ Could not load CBSA crosswalk: ${error.message}`);
    crosswalkLoaded = true;
    return;
  }

  if (data) {
    for (const row of data) {
      if (row.zillow_region_id && row.cbsa_code) {
        // Map by region_id
        cbsaCrosswalkMap.set(String(row.zillow_region_id), row.cbsa_code);

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
    console.log(`  ✅ Loaded ${cbsaCrosswalkMap.size} CBSA mappings by region_id`);
    console.log(`  ✅ Loaded ${cbsaNameMap.size} CBSA mappings by name`);
  }

  crosswalkLoaded = true;
}

/**
 * Import a single dataset
 */
export async function importDataset(config: DatasetConfig): Promise<ImportResult> {
  const supabase = createZillowUsMetroClient();

  // Load crosswalk if importing to zillow_metro
  if (config.tableName === 'zillow_metro') {
    await loadCbsaCrosswalk();
  }

  console.log(`\n📊 Processing: ${config.description}`);
  console.log(`   Table: ${config.tableName}`);
  console.log(`   Filter: ${config.filterUS ? 'US Only' : config.filterMetro ? 'Metro Only' : 'All'}`);

  // Download
  console.log(`  📥 Downloading...`);
  const downloadResult = await downloadDataset(config.url);
  if (!downloadResult.success) {
    console.error(`  ❌ Download failed: ${downloadResult.error}`);
    return { marketsCreated: 0, recordsInserted: 0, errors: 1 };
  }

  const sizeKB = (downloadResult.csvContent!.length / 1024).toFixed(1);
  console.log(`  ✅ Downloaded ${sizeKB} KB`);

  // Parse CSV
  const records: any[] = parseSync(downloadResult.csvContent!, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`  📋 Parsed ${records.length} total rows`);

  // Filter records
  const filteredRecords = filterRecords(records, config);
  console.log(`  🔍 Filtered to ${filteredRecords.length} rows`);

  // Process records
  return await processRecords(supabase, filteredRecords, config);
}

/**
 * Filter records based on US or Metro filter
 */
function filterRecords(records: any[], config: DatasetConfig): any[] {
  if (config.filterUS) {
    return records.filter(r =>
      r.RegionID === '102001' ||
      r.RegionType === 'country' ||
      r.RegionName === 'United States'
    );
  } else if (config.filterMetro) {
    return records.filter(r =>
      r.RegionType === 'msa' &&
      r.RegionID !== '102001' &&
      r.RegionName !== 'United States'
    );
  }
  return records;
}

/**
 * Process filtered records and insert into database
 */
async function processRecords(
  supabase: any,
  records: any[],
  config: DatasetConfig
): Promise<ImportResult> {
  let marketsCreated = 0;
  let recordsInserted = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const result = await processRecord(supabase, record, config);
      marketsCreated += result.marketsCreated;
      recordsInserted += result.recordsInserted;
      errors += result.errors;
    } catch (error: any) {
      errors++;
    }
  }

  console.log(`  ✅ Imported: ${marketsCreated} markets, ${recordsInserted} time series records`);
  if (errors > 0) {
    console.log(`  ⚠️  Errors: ${errors}`);
  }

  return { marketsCreated, recordsInserted, errors };
}

/**
 * Process a single record
 */
async function processRecord(
  supabase: any,
  record: any,
  config: DatasetConfig
): Promise<ImportResult> {
  const regionId = record.RegionID;
  const regionName = record.RegionName;

  if (!regionId || !regionName) {
    return { marketsCreated: 0, recordsInserted: 0, errors: 0 };
  }

  const regionType = record.RegionType === 'msa' ? 'msa' :
    record.RegionType === 'country' ? 'country' :
      record.RegionType;
  const stateName = record.StateName || null;
  const sizeRank = record.SizeRank ? parseInt(record.SizeRank) : null;

  // Upsert market
  const marketData = {
    region_id: regionId,
    region_name: regionName,
    region_type: regionType,
    state_name: stateName || undefined,
    state_code: stateName ? stateName.substring(0, 2).toUpperCase() : undefined,
    size_rank: sizeRank || undefined
  };

  const { error: marketError } = await supabase
    .from('markets')
    .upsert(marketData, { onConflict: 'region_id' });

  if (marketError) {
    return { marketsCreated: 0, recordsInserted: 0, errors: 1 };
  }

  // Extract and insert time series data
  const recordsInserted = await insertTimeSeries(supabase, record, config, regionId);

  return {
    marketsCreated: 1,
    recordsInserted,
    errors: 0
  };
}

/**
 * Insert time series data for a record
 */
async function insertTimeSeries(
  supabase: any,
  record: any,
  config: DatasetConfig,
  regionId: string
): Promise<number> {
  const dateColumns = Object.keys(record).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
  const timeSeriesData: any[] = [];

  const propertyType = getPropertyType(config.datasetType);
  const geography = config.filterUS ? 'United States' : 'Metro';
  const tier = requiresTier(config.datasetType) ? '0.33_0.67' : undefined;

  // Build options for zillow_metro table (includes CBSA code from crosswalk)
  // Try: 1) CSV CBSACode, 2) crosswalk by region_id, 3) crosswalk by name
  let cbsaCode: string | undefined = record.CBSACode || cbsaCrosswalkMap.get(String(regionId));
  if (!cbsaCode && record.RegionName) {
    cbsaCode = cbsaNameMap.get(normalizeMetroName(record.RegionName))
      || cbsaNameMap.get(extractPrimaryMetroName(record.RegionName));
  }

  const options = config.tableName === 'zillow_metro' ? {
    cbsaCode: cbsaCode || undefined,
    regionName: record.RegionName || undefined,
    stateCode: record.StateName?.length === 2 ? record.StateName : undefined
  } : undefined;

  // For market_heat (market_temp_index), allow zero and negative values
  const allowZeroAndNegative = config.datasetType === 'market_temp_index';

  for (const dateCol of dateColumns) {
    const value = parseFloat(record[dateCol]);
    // Skip NaN/null, and skip zero for most metrics (but allow for market_heat)
    if (isNaN(value) || value === null || (!allowZeroAndNegative && value === 0)) continue;
    timeSeriesData.push(buildRecord(
        regionId,
        dateCol,
        value,
        config.datasetType,
        config.tableName,
        propertyType,
        geography,
        tier,
        options
      ));
    }
  }

  if (timeSeriesData.length === 0) {
    return 0;
  }

  // Insert in batches
  let inserted = 0;
  const batchSize = 100;
  const conflictColumns = getConflictColumns(config.tableName, config.datasetType);

  for (let i = 0; i < timeSeriesData.length; i += batchSize) {
    const batch = timeSeriesData.slice(i, i + batchSize);

    const { error: tsError } = await supabase
      .from(config.tableName)
      .upsert(batch, { onConflict: conflictColumns });

    if (!tsError) {
      inserted += batch.length;
    }
  }

  return inserted;
}

/**
 * Print import summary
 */
export function printSummary(results: ProcessedResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.errors === 0);
  const failed = results.filter(r => r.errors > 0);

  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  let totalMarkets = 0;
  let totalRecords = 0;

  results.forEach(r => {
    totalMarkets += r.marketsCreated;
    totalRecords += r.recordsInserted;
  });

  console.log(`📊 Total markets created/updated: ${totalMarkets}`);
  console.log(`📊 Total time series records: ${totalRecords.toLocaleString()}`);

  // Summary by table
  console.log('\n📋 Summary by Table:');
  const byTable = new Map<string, number>();
  results.forEach(r => {
    const current = byTable.get(r.config.tableName) || 0;
    byTable.set(r.config.tableName, current + r.recordsInserted);
  });

  Array.from(byTable.entries()).forEach(([table, count]) => {
    console.log(`  ${table}: ${count.toLocaleString()} records`);
  });

  if (failed.length > 0) {
    console.log('\n❌ Failed datasets:');
    failed.forEach(r => {
      console.log(`  - ${r.config.description}: ${r.errors} errors`);
    });
  }

  console.log('\n✅ Process complete!');
}
