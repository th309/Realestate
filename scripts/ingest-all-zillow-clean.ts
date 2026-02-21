/**
 * Clean Ingest All Zillow Datasets
 *
 * This script performs a clean ingest of all Zillow datasets into the 4 new tables:
 * - zillow_state
 * - zillow_metro
 * - zillow_county
 * - zillow_zip
 *
 * Features:
 * - Truncates all tables before import (clean ingest)
 * - Status updates every 60 seconds
 * - Per-dataset and per-table status tracking
 *
 * Usage:
 *   npx tsx scripts/ingest-all-zillow-clean.ts
 */

import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parse as parseSync } from 'csv-parse/sync';
import { logIngestionDetail } from './utils/log-ingestion-detail';

const STATUS_FILE = join(__dirname, '../zillow-import-status.txt');

// Load environment variables
config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../packages/frontend/.env.local') });
config({ path: join(__dirname, '../packages/backend/.env') });

const DATA_DIR = join(__dirname, '../data/zillow');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================================================
// TYPES
// ============================================================================

interface DatasetConfig {
  id: string;
  downloadUrl: string;
  description: string;
  datasetType: string;
  geography: string;
}

interface DatasetStatus {
  id: string;
  description: string;
  geography: string;
  status: 'pending' | 'downloading' | 'importing' | 'completed' | 'failed';
  recordsInserted: number;
  errorMessage?: string;
  startTime?: number;
  endTime?: number;
}

interface TableStatus {
  tableName: string;
  rowCount: number;
  lastUpdated: Date;
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

const datasetStatuses: Map<string, DatasetStatus> = new Map();
const tableRowCounts: Map<string, number> = new Map();
const cbsaCrosswalMap: Map<string, string> = new Map(); // region_id -> cbsa_code
const cbsaNameMap: Map<string, string> = new Map(); // normalized_name -> cbsa_code
let statusIntervalId: NodeJS.Timeout | null = null;
let importStartTime: number = 0;
let currentDatasetIndex: number = 0;
let totalDatasets: number = 0;

const TARGET_TABLES = ['zillow_state', 'zillow_metro', 'zillow_county', 'zillow_city', 'zillow_zip'];

// ============================================================================
// DATABASE CLIENT
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function createSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

function getTableForGeography(geography: string): string {
  const geoLower = geography.toLowerCase();
  if (geoLower === 'state') return 'zillow_state';
  if (geoLower === 'metro' || geoLower === 'msa') return 'zillow_metro';
  if (geoLower === 'county') return 'zillow_county';
  if (geoLower === 'city') return 'zillow_city';
  if (geoLower === 'zip') return 'zillow_zip';
  if (geoLower === 'united states' || geoLower === 'us') return 'zillow_metro';
  return 'zillow_metro';
}

function getMetricName(datasetType: string): string {
  const metricMap: Record<string, string> = {
    'zhvi': 'zhvi',
    'zhvf_growth': 'zhvf',
    'zori': 'zori',
    'zordi': 'zordi',
    'invt_fs': 'inventory',
    'new_listings': 'new_listings',
    'new_pending': 'pending_sales',
    'mlp': 'list_price',
    'sales_count_now': 'sales_count',
    'median_sale_price': 'sale_price',
    'median_sale_price_now': 'sale_price',
    'median_sale_to_list': 'sale_to_list',
    'mean_doz_pending': 'dom',
    'median_days_to_close': 'dom',
    'perc_listings_price_cut': 'price_cuts',
    'med_listings_price_cut_amt': 'price_cuts',
    'med_listings_price_cut_perc': 'price_cuts',
    'market_temp_index': 'market_heat',
    'new_con_sales_count_raw': 'new_con_sales',
    'new_con_median_sale_price': 'new_con_price',
    'new_con_median_sale_price_raw': 'new_con_price',
    'new_con_median_sale_price_per_sqft': 'new_con_price_sqft',
    'new_homeowner_income_needed': 'homeowner_income',
    'new_renter_income_needed': 'renter_income',
    'affordable_home_price': 'affordable_price',
    'years_to_save': 'years_to_save',
    'new_homeowner_affordability': 'homeowner_afford',
    'new_renter_affordability': 'renter_afford'
  };
  return metricMap[datasetType] || datasetType;
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

function extractStateCode(record: any): string | null {
  if (record.State) return record.State;
  if (record.StateName) {
    if (record.StateName.length === 2) return record.StateName;
    const code = STATE_NAME_TO_CODE[record.StateName];
    if (code) return code;
  }
  if (record.RegionName === "United States") return "US";
  if (record.RegionName && STATE_NAME_TO_CODE[record.RegionName]) {
    return STATE_NAME_TO_CODE[record.RegionName];
  }
  return null;
}

function buildFipsCode(record: any): string | null {
  const stateCode = record.StateCodeFIPS;
  const countyCode = record.MunicipalCodeFIPS;
  if (stateCode && countyCode) {
    return String(stateCode).padStart(2, '0') + String(countyCode).padStart(3, '0');
  }
  return null;
}

// ============================================================================
// STATUS DISPLAY
// ============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function printStatusReport(): void {
  const now = Date.now();
  const elapsed = now - importStartTime;

  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push(`ZILLOW IMPORT STATUS - ${new Date().toISOString()}`);
  lines.push(`Elapsed: ${formatDuration(elapsed)}`);
  lines.push('='.repeat(80));

  // Table Status
  lines.push('');
  lines.push('--- TABLE STATUS ---');
  lines.push('Table Name'.padEnd(20) + 'Row Count'.padStart(15));
  lines.push('-'.repeat(35));
  let totalRows = 0;
  for (const table of TARGET_TABLES) {
    const count = tableRowCounts.get(table) || 0;
    totalRows += count;
    lines.push(table.padEnd(20) + count.toLocaleString().padStart(15));
  }
  lines.push('-'.repeat(35));
  lines.push('TOTAL'.padEnd(20) + totalRows.toLocaleString().padStart(15));

  // Dataset Status Summary
  const statuses = Array.from(datasetStatuses.values());
  const pending = statuses.filter(s => s.status === 'pending').length;
  const downloading = statuses.filter(s => s.status === 'downloading').length;
  const importing = statuses.filter(s => s.status === 'importing').length;
  const completed = statuses.filter(s => s.status === 'completed').length;
  const failed = statuses.filter(s => s.status === 'failed').length;

  lines.push('');
  lines.push('--- DATASET STATUS SUMMARY ---');
  lines.push(`Pending:     ${pending}`);
  lines.push(`Downloading: ${downloading}`);
  lines.push(`Importing:   ${importing}`);
  lines.push(`Completed:   ${completed}`);
  lines.push(`Failed:      ${failed}`);
  lines.push(`Progress:    ${currentDatasetIndex}/${totalDatasets} (${Math.round((currentDatasetIndex / totalDatasets) * 100)}%)`);

  // Current Dataset
  const currentDataset = statuses.find(s => s.status === 'downloading' || s.status === 'importing');
  if (currentDataset) {
    lines.push('');
    lines.push(`Currently processing: ${currentDataset.id}`);
    lines.push(`  Status: ${currentDataset.status}`);
    lines.push(`  Records: ${currentDataset.recordsInserted.toLocaleString()}`);
    if (currentDataset.startTime) {
      lines.push(`  Duration: ${formatDuration(now - currentDataset.startTime)}`);
    }
  }

  // Recent Completed
  const recentCompleted = statuses
    .filter(s => s.status === 'completed')
    .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
    .slice(0, 5);

  if (recentCompleted.length > 0) {
    lines.push('');
    lines.push('--- RECENTLY COMPLETED ---');
    for (const ds of recentCompleted) {
      const duration = ds.endTime && ds.startTime ? formatDuration(ds.endTime - ds.startTime) : 'N/A';
      lines.push(`  ${ds.id}: ${ds.recordsInserted.toLocaleString()} records (${duration})`);
    }
  }

  // Failed datasets
  const failedDatasets = statuses.filter(s => s.status === 'failed');
  if (failedDatasets.length > 0) {
    lines.push('');
    lines.push('--- FAILED DATASETS ---');
    for (const ds of failedDatasets) {
      lines.push(`  ${ds.id}: ${ds.errorMessage || 'Unknown error'}`);
    }
  }

  // All datasets status
  lines.push('');
  lines.push('--- ALL DATASETS ---');
  for (const ds of statuses) {
    const icon = ds.status === 'completed' ? '[OK]' : ds.status === 'failed' ? '[FAIL]' : ds.status === 'importing' ? '[>>>]' : '[  ]';
    lines.push(`${icon} ${ds.id}: ${ds.recordsInserted.toLocaleString()} records`);
  }

  lines.push('');
  lines.push('='.repeat(80));
  lines.push(`Last updated: ${new Date().toLocaleTimeString()}`);
  lines.push('(This file updates every 60 seconds)');

  const output = lines.join('\n');

  // Write to file
  writeFileSync(STATUS_FILE, output);

  // Also print to console
  console.log('\n' + output);
}

// ============================================================================
// DOWNLOAD FUNCTION
// ============================================================================

async function downloadDataset(url: string): Promise<{ success: boolean; csvContent?: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const csvContent = await response.text();
    return { success: true, csvContent };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// IMPORT FUNCTION
// ============================================================================

async function importCSV(
  supabase: SupabaseClient,
  csvContent: string,
  datasetConfig: DatasetConfig,
  datasetStatus: DatasetStatus
): Promise<{ recordsInserted: number; errors: number }> {
  const records: any[] = parseSync(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  let recordsInserted = 0;
  let errors = 0;

  const geography = datasetConfig.geography;
  const tableName = getTableForGeography(geography);
  const metricName = getMetricName(datasetConfig.datasetType);
  const batchSize = 10000; // Aggressive batch size for max throughput

  // Collect all time series data
  const allTimeSeriesData: any[] = [];

  for (const record of records) {
    const regionId = parseInt(record.RegionID, 10);
    const regionName = record.RegionName || '';

    if (isNaN(regionId) || !regionName) continue;

    const stateCode = extractStateCode(record);
    const fipsCode = buildFipsCode(record);
    // Use CBSACode from CSV if available, otherwise look up from crosswalk by ID or name
    let cbsaCode = record.CBSACode || cbsaCrosswalMap.get(String(regionId)) || null;

    // Fallback to name-based lookup if region_id lookup failed
    if (!cbsaCode && regionName) {
      cbsaCode = cbsaNameMap.get(normalizeMetroName(regionName))
        || cbsaNameMap.get(extractPrimaryMetroName(regionName))
        || null;
    }

    const dateColumns = Object.keys(record).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));

    for (const dateCol of dateColumns) {
      const value = parseFloat(record[dateCol]);
      if (isNaN(value) || value === null) continue;

      const recordData: any = {
        region_id: regionId,
        region_name: regionName,
        state_code: stateCode,
        period_date: dateCol,
        metric_name: metricName,
        value: value
      };

      if (geography.toLowerCase() === 'metro' && cbsaCode) {
        recordData.cbsa_code = cbsaCode;
      }
      if (geography.toLowerCase() === 'county' && fipsCode) {
        recordData.fips_code = fipsCode;
      }

      allTimeSeriesData.push(recordData);
    }
  }

  // Batch upsert
  for (let i = 0; i < allTimeSeriesData.length; i += batchSize) {
    const batch = allTimeSeriesData.slice(i, i + batchSize);

    let retries = 0;
    const maxRetries = 5;
    let success = false;

    while (!success && retries < maxRetries) {
      try {
        const { error: tsError } = await supabase
          .from(tableName)
          .upsert(batch, { onConflict: 'region_id,period_date,metric_name' });

        if (tsError) {
          throw new Error(tsError.message);
        }
        success = true;
        recordsInserted += batch.length;
        datasetStatus.recordsInserted = recordsInserted;

        // Update table row count
        const currentCount = tableRowCounts.get(tableName) || 0;
        tableRowCounts.set(tableName, currentCount + batch.length);
      } catch (err: any) {
        retries++;
        if (retries >= maxRetries) {
          errors++;
        } else {
          const waitTime = 1000 * Math.pow(1.5, retries);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Small delay every 5000 records to prevent overwhelming the database
    if (i % 5000 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  return { recordsInserted, errors };
}

// ============================================================================
// TABLE OPERATIONS
// ============================================================================

async function truncateAllTables(supabase: SupabaseClient): Promise<void> {
  console.log('\nTruncating all target tables for clean ingest...');

  for (const table of TARGET_TABLES) {
    console.log(`  Truncating ${table}...`);
    const { error } = await supabase.rpc('truncate_table', { table_name: table });

    if (error) {
      // Try direct delete if RPC doesn't exist
      console.log(`  RPC failed, using DELETE for ${table}...`);
      const { error: deleteError } = await supabase.from(table).delete().neq('region_id', -999999);
      if (deleteError) {
        console.error(`  Warning: Could not truncate ${table}: ${deleteError.message}`);
      }
    }

    tableRowCounts.set(table, 0);
    console.log(`  ${table} cleared`);
  }

  console.log('All tables truncated.\n');
}

async function getTableCounts(supabase: SupabaseClient): Promise<void> {
  for (const table of TARGET_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (!error && count !== null) {
      tableRowCounts.set(table, count);
    }
  }
}

/**
 * Normalize metro name for fuzzy matching
 * "Peoria, IL" -> "peoria il"
 * "Chicago-Naperville-Elgin, IL-IN-WI" -> "chicago naperville elgin il in wi"
 */
function normalizeMetroName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,\-]/g, ' ')  // Replace commas and hyphens with spaces
    .replace(/[^a-z0-9\s]/g, '')  // Remove other punctuation
    .replace(/\s+/g, ' ')  // Collapse multiple spaces
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

async function loadCbsaCrosswalk(supabase: SupabaseClient): Promise<void> {
  console.log('Loading CBSA crosswalk data...');

  const { data, error } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, zillow_region_name, cbsa_code, cbsa_title');

  if (error) {
    console.warn(`Warning: Could not load CBSA crosswalk: ${error.message}`);
    return;
  }

  if (data) {
    for (const row of data) {
      if (row.zillow_region_id && row.cbsa_code) {
        // Map by region_id
        cbsaCrosswalMap.set(String(row.zillow_region_id), row.cbsa_code);

        // Map by normalized Zillow region name
        if (row.zillow_region_name) {
          const normalizedZillow = normalizeMetroName(row.zillow_region_name);
          if (!cbsaNameMap.has(normalizedZillow)) {
            cbsaNameMap.set(normalizedZillow, row.cbsa_code);
          }
          // Also map by primary name only (e.g., "peoria" without state)
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
          // Also map by primary name only
          const primaryCbsa = extractPrimaryMetroName(row.cbsa_title);
          if (!cbsaNameMap.has(primaryCbsa)) {
            cbsaNameMap.set(primaryCbsa, row.cbsa_code);
          }
        }
      }
    }
    console.log(`Loaded ${cbsaCrosswalMap.size} CBSA mappings by region_id`);
    console.log(`Loaded ${cbsaNameMap.size} CBSA mappings by name`);
  }
}

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================

async function processDataset(
  supabase: SupabaseClient,
  dataset: DatasetConfig,
  runId?: string,
): Promise<void> {
  const status = datasetStatuses.get(dataset.id)!;
  status.status = 'downloading';
  status.startTime = Date.now();

  console.log(`\n[${currentDatasetIndex + 1}/${totalDatasets}] ${dataset.id}`);
  console.log(`  Geography: ${dataset.geography}`);
  console.log(`  Table: ${getTableForGeography(dataset.geography)}`);

  // Download
  console.log(`  Downloading...`);
  const downloadResult = await downloadDataset(dataset.downloadUrl);

  if (!downloadResult.success) {
    status.status = 'failed';
    status.errorMessage = downloadResult.error;
    status.endTime = Date.now();
    console.log(`  FAILED: ${downloadResult.error}`);
    if (runId) {
      await logIngestionDetail(supabase, runId, getMetricName(dataset.datasetType), dataset.geography, 'failed', 0, 0, Date.now() - status.startTime!, downloadResult.error);
    }
    return;
  }

  // Import
  status.status = 'importing';
  console.log(`  Importing...`);

  try {
    const importResult = await importCSV(supabase, downloadResult.csvContent!, dataset, status);
    status.status = 'completed';
    status.recordsInserted = importResult.recordsInserted;
    status.endTime = Date.now();

    const duration = formatDuration(status.endTime - status.startTime!);
    console.log(`  COMPLETED: ${importResult.recordsInserted.toLocaleString()} records (${duration})`);
    if (runId) {
      await logIngestionDetail(supabase, runId, getMetricName(dataset.datasetType), dataset.geography, 'success', importResult.recordsInserted, importResult.errors, status.endTime! - status.startTime!);
    }
  } catch (error: any) {
    status.status = 'failed';
    status.errorMessage = error.message;
    status.endTime = Date.now();
    console.log(`  FAILED: ${error.message}`);
    if (runId) {
      await logIngestionDetail(supabase, runId, getMetricName(dataset.datasetType), dataset.geography, 'failed', 0, 0, Date.now() - (status.startTime || Date.now()), error.message);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('ZILLOW CLEAN INGEST - ALL DATASETS');
  console.log('='.repeat(80));
  console.log(`Start Time: ${new Date().toISOString()}`);
  console.log('');

  importStartTime = Date.now();
  const supabase = createSupabaseClient();

  // Create parent ingestion log row
  const { data: logRow } = await supabase
    .from('data_ingestion_log')
    .insert({
      source: 'zillow',
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  const runId = logRow?.id;

  // Load dataset configuration
  let ZILLOW_DATASETS: DatasetConfig[];
  try {
    const zillowDatasets = require('../packages/frontend/lib/data-ingestion/sources/zillow-datasets');
    ZILLOW_DATASETS = zillowDatasets.ZILLOW_DATASETS;
  } catch (error) {
    console.error('Could not load Zillow dataset configuration');
    process.exit(1);
  }

  totalDatasets = ZILLOW_DATASETS.length;
  console.log(`Total datasets to import: ${totalDatasets}`);
  console.log(`Target tables: ${TARGET_TABLES.join(', ')}`);

  // Initialize dataset statuses
  for (const dataset of ZILLOW_DATASETS) {
    datasetStatuses.set(dataset.id, {
      id: dataset.id,
      description: dataset.description,
      geography: dataset.geography,
      status: 'pending',
      recordsInserted: 0
    });
  }

  // Truncate all tables for clean ingest
  await truncateAllTables(supabase);

  // Load CBSA crosswalk for metro data
  await loadCbsaCrosswalk(supabase);

  // Start status reporting every 60 seconds
  statusIntervalId = setInterval(() => {
    printStatusReport();
  }, 60000);

  // Print initial status
  printStatusReport();

  // Sort datasets by size (smallest first)
  const getSizePriority = (id: string): number => {
    if (id.includes('-us-')) return 0;
    if (id.includes('-state-')) return 1;
    if (id.includes('-metro-')) return 2;
    if (id.includes('-county-')) return 3;
    if (id.includes('-city-')) return 4;
    if (id.includes('-zip-')) return 5;
    return 3;
  };

  const sortedDatasets = [...ZILLOW_DATASETS].sort(
    (a, b) => getSizePriority(a.id) - getSizePriority(b.id)
  );

  // Process each dataset
  for (const dataset of sortedDatasets) {
    await processDataset(supabase, dataset, runId);
    currentDatasetIndex++;

    // Small delay between datasets
    if (currentDatasetIndex < totalDatasets) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Stop status reporting
  if (statusIntervalId) {
    clearInterval(statusIntervalId);
  }

  // Get final table counts
  await getTableCounts(supabase);

  // Update parent log row
  if (runId) {
    const statuses = Array.from(datasetStatuses.values());
    const completed = statuses.filter(s => s.status === 'completed');
    const failed = statuses.filter(s => s.status === 'failed');
    const totalRecords = completed.reduce((sum, s) => sum + s.recordsInserted, 0);

    await supabase
      .from('data_ingestion_log')
      .update({
        status: failed.length === 0 ? 'success' : 'partial',
        completed_at: new Date().toISOString(),
        records_success: totalRecords,
        records_error: failed.length,
        duration_ms: Date.now() - importStartTime,
      })
      .eq('id', runId);
  }

  // Print final report
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('FINAL REPORT');
  console.log('='.repeat(80));

  const statuses = Array.from(datasetStatuses.values());
  const completed = statuses.filter(s => s.status === 'completed');
  const failed = statuses.filter(s => s.status === 'failed');

  const totalDuration = formatDuration(Date.now() - importStartTime);
  const totalRecords = completed.reduce((sum, s) => sum + s.recordsInserted, 0);

  console.log(`\nDuration: ${totalDuration}`);
  console.log(`Datasets Completed: ${completed.length}/${totalDatasets}`);
  console.log(`Datasets Failed: ${failed.length}`);
  console.log(`Total Records Inserted: ${totalRecords.toLocaleString()}`);

  console.log('\n--- FINAL TABLE COUNTS ---');
  for (const table of TARGET_TABLES) {
    const count = tableRowCounts.get(table) || 0;
    console.log(`  ${table}: ${count.toLocaleString()}`);
  }

  if (failed.length > 0) {
    console.log('\n--- FAILED DATASETS ---');
    for (const ds of failed) {
      console.log(`  ${ds.id}: ${ds.errorMessage}`);
    }
  }

  console.log('\n--- ALL DATASET RESULTS ---');
  for (const ds of statuses) {
    const icon = ds.status === 'completed' ? 'OK' : 'FAIL';
    console.log(`  [${icon}] ${ds.id}: ${ds.recordsInserted.toLocaleString()} records`);
  }

  console.log('\n' + '='.repeat(80));
  if (failed.length === 0) {
    console.log('ALL DATASETS IMPORTED SUCCESSFULLY');
  } else {
    console.log(`IMPORT COMPLETED WITH ${failed.length} FAILURES`);
  }
  console.log('='.repeat(80));

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  if (statusIntervalId) {
    clearInterval(statusIntervalId);
  }
  process.exit(1);
});
