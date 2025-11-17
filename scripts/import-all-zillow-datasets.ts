/**
 * Download and Import All Zillow Datasets
 * 
 * Downloads and imports all available Zillow datasets one by one.
 * 
 * Usage:
 *   npx tsx scripts/import-all-zillow-datasets.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseSync } from 'csv-parse/sync';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DATA_DIR = join(__dirname, '../data/zillow');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Import dataset configuration
let ZILLOW_DATASETS: any[];
try {
  const zillowDatasets = require('../web/lib/data-ingestion/sources/zillow-datasets');
  ZILLOW_DATASETS = zillowDatasets.ZILLOW_DATASETS;
} catch (error) {
  console.error('❌ Could not import zillow-datasets');
  process.exit(1);
}

interface ImportResult {
  datasetId: string;
  success: boolean;
  marketsCreated: number;
  timeSeriesInserted: number;
  errors: number;
  errorMessage?: string;
}

/**
 * Download a dataset
 */
async function downloadDataset(config: any): Promise<{ success: boolean; csvContent?: string; error?: string }> {
  try {
    console.log(`  📥 Downloading from: ${config.downloadUrl}`);
    const response = await axios.get(config.downloadUrl, {
      timeout: 120000,
      maxContentLength: 200 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const csvContent = response.data;
    const sizeKB = (csvContent.length / 1024).toFixed(1);
    console.log(`  ✅ Downloaded ${sizeKB} KB`);
    
    return { success: true, csvContent };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Determine which table to use based on dataset type
 */
function getTableName(datasetType: string): string {
  const tableMap: Record<string, string> = {
    'zhvi': 'zillow_zhvi',
    'zori': 'zillow_zori',
    'invt_fs': 'zillow_inventory',
    'sales_count_now': 'zillow_sales_count',
    'median_sale_price': 'zillow_sales_price',
    'mean_doz_pending': 'zillow_days_to_pending'
  };
  
  return tableMap[datasetType] || 'market_time_series';
}

/**
 * Import CSV data into database
 */
async function importCSV(
  csvContent: string,
  metricName: string,
  datasetConfig: any
): Promise<{ marketsCreated: number; timeSeriesInserted: number; errors: number }> {
  const records: any[] = parseSync(csvContent, {
    columns: true,
    skip_empty_lines: true
  });
  
  let marketsCreated = 0;
  let timeSeriesInserted = 0;
  let errors = 0;
  
  // Determine target table
  const tableName = getTableName(datasetConfig.datasetType);
  
  for (const [index, record] of records.entries()) {
    try {
      const regionId = record.RegionID;
      const regionName = record.RegionName;
      const regionType = record.RegionType === 'msa' ? 'msa' : record.RegionType;
      const stateName = record.StateName || null;
      const sizeRank = record.SizeRank ? parseInt(record.SizeRank) : null;
      
      if (!regionId || !regionName) {
        continue;
      }
      
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
        errors++;
        continue;
      }
      
      marketsCreated++;
      
      // Extract time series data
      const dateColumns = Object.keys(record).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
      const timeSeriesData: any[] = [];
      
      for (const dateCol of dateColumns) {
        const value = parseFloat(record[dateCol]);
        if (!isNaN(value) && value !== null && value !== 0) {
          // Build record based on table structure
          const recordData: any = {
            region_id: regionId,
            date: dateCol,
            property_type: datasetConfig.propertyType || 'sfrcondo',
            geography: datasetConfig.geography
          };
          
          // Add value field based on table
          if (tableName === 'zillow_zhvi') {
            recordData.value = value;
            recordData.tier = datasetConfig.tier || 'middle';
          } else if (tableName === 'zillow_zori') {
            recordData.value = value;
          } else if (tableName === 'zillow_inventory') {
            recordData.inventory_count = Math.round(value);
          } else if (tableName === 'zillow_sales_count') {
            recordData.sales_count = Math.round(value);
          } else if (tableName === 'zillow_sales_price') {
            recordData.median_price = value;
          } else if (tableName === 'zillow_days_to_pending') {
            recordData.days = value;
          } else {
            // Fallback to generic table
            recordData.metric_name = metricName;
            recordData.metric_value = value;
            recordData.data_source = 'zillow';
            recordData.attributes = {
              property_type: datasetConfig.propertyType || 'sfrcondo',
              tier: datasetConfig.tier || 'middle',
              geography: datasetConfig.geography,
              dataset_type: datasetConfig.datasetType
            };
          }
          
          timeSeriesData.push(recordData);
        }
      }
      
      // Insert time series in batches
      if (timeSeriesData.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < timeSeriesData.length; i += batchSize) {
          const batch = timeSeriesData.slice(i, i + batchSize);
          
          // Determine conflict resolution based on table
          let conflictColumns = 'region_id,date';
          if (tableName === 'zillow_zhvi') {
            conflictColumns = 'region_id,date,property_type,tier';
          } else if (tableName === 'zillow_zori' || tableName === 'zillow_inventory' || 
                     tableName === 'zillow_sales_count' || tableName === 'zillow_sales_price' || 
                     tableName === 'zillow_days_to_pending') {
            conflictColumns = 'region_id,date,property_type';
          } else {
            conflictColumns = 'region_id,date,metric_name,data_source,attributes';
          }
          
          const { error: tsError } = await supabase
            .from(tableName)
            .upsert(batch, { onConflict: conflictColumns });
          
          if (tsError) {
            errors++;
          } else {
            timeSeriesInserted += batch.length;
          }
        }
      }
      
    } catch (error: any) {
      errors++;
    }
  }
  
  return { marketsCreated, timeSeriesInserted, errors };
}

/**
 * Process a single dataset
 */
async function processDataset(dataset: any): Promise<ImportResult> {
  console.log(`\n📊 Processing: ${dataset.id}`);
  console.log(`   Description: ${dataset.description}`);
  
  // Determine metric name from dataset type (for logging)
  let metricName = dataset.datasetType;
  if (metricName === 'invt_fs') metricName = 'inventory';
  if (metricName === 'sales_count_now') metricName = 'sales_count';
  if (metricName === 'median_sale_price') metricName = 'median_sale_price';
  if (metricName === 'mean_doz_pending') metricName = 'days_to_pending';
  
  // Log which table will be used
  const tableName = getTableName(dataset.datasetType);
  console.log(`   Target table: ${tableName}`);
  
  // Download
  const downloadResult = await downloadDataset(dataset);
  if (!downloadResult.success) {
    return {
      datasetId: dataset.id,
      success: false,
      marketsCreated: 0,
      timeSeriesInserted: 0,
      errors: 0,
      errorMessage: downloadResult.error
    };
  }
  
  // Import
  console.log(`  🔄 Importing data...`);
  const importResult = await importCSV(downloadResult.csvContent!, metricName, dataset);
  
  console.log(`  ✅ Imported: ${importResult.marketsCreated} markets, ${importResult.timeSeriesInserted} time series records`);
  
  return {
    datasetId: dataset.id,
    success: importResult.errors === 0,
    marketsCreated: importResult.marketsCreated,
    timeSeriesInserted: importResult.timeSeriesInserted,
    errors: importResult.errors
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Zillow Dataset Import Process');
  console.log('='.repeat(60));
  console.log(`Total datasets: ${ZILLOW_DATASETS.length}\n`);
  
  // Skip the one we already imported
  const datasetsToProcess = ZILLOW_DATASETS.filter(d => d.id !== 'zhvi-metro-all-homes-sm-sa');
  
  console.log(`Processing ${datasetsToProcess.length} datasets...\n`);
  
  const results: ImportResult[] = [];
  
  for (const [index, dataset] of datasetsToProcess.entries()) {
    console.log(`\n[${index + 1}/${datasetsToProcess.length}]`);
    
    try {
      const result = await processDataset(dataset);
      results.push(result);
      
      // Add delay between datasets to be respectful
      if (index < datasetsToProcess.length - 1) {
        console.log('  ⏳ Waiting 2 seconds before next dataset...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      console.error(`  ❌ Fatal error: ${error.message}`);
      results.push({
        datasetId: dataset.id,
        success: false,
        marketsCreated: 0,
        timeSeriesInserted: 0,
        errors: 0,
        errorMessage: error.message
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  let totalMarkets = 0;
  let totalTimeSeries = 0;
  
  results.forEach(r => {
    totalMarkets += r.marketsCreated;
    totalTimeSeries += r.timeSeriesInserted;
  });
  
  console.log(`📊 Total markets created/updated: ${totalMarkets}`);
  console.log(`📊 Total time series records: ${totalTimeSeries.toLocaleString()}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed datasets:');
    failed.forEach(r => {
      console.log(`  - ${r.datasetId}: ${r.errorMessage || 'Unknown error'}`);
    });
  }
  
  console.log('\n✅ Process complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

