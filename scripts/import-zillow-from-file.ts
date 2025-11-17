/**
 * Import Zillow Data from Local CSV File
 * 
 * Imports a downloaded Zillow CSV file into the database.
 * 
 * Usage:
 *   npx tsx scripts/import-zillow-from-file.ts --file data/zillow/zhvi-metro-all-homes-sm-sa.csv --metric zhvi --limit 5
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseSync } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Set them in web/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface MarketRecord {
  region_id: string;
  region_name: string;
  region_type: string;
  state_name?: string;
  state_code?: string;
  size_rank?: number;
}

interface TimeSeriesRecord {
  region_id: string;
  date: string;
  metric_name: string;
  metric_value: number;
  data_source: string;
  attributes?: Record<string, any>;
}

/**
 * Import Zillow CSV file into database
 */
async function importZillowFromFile(
  filePath: string,
  metricName: string = 'zhvi',
  limitRows?: number
) {
  console.log(`\n📊 Starting Zillow import from file: ${filePath}`);
  console.log(`   Metric: ${metricName}`);
  console.log('================================================');
  
  // Read CSV file
  console.log(`📥 Reading file: ${filePath}`);
  const csvContent = readFileSync(filePath, 'utf-8');
  console.log(`✅ Read ${(csvContent.length / 1024).toFixed(1)} KB`);
  
  // Parse CSV
  const records: any[] = parseSync(csvContent, {
    columns: true,
    skip_empty_lines: true
  });
  
  console.log(`📋 Parsed ${records.length} regions`);
  
  // Limit rows if specified (for testing)
  const recordsToProcess = limitRows ? records.slice(0, limitRows) : records;
  console.log(`🔄 Processing ${recordsToProcess.length} regions`);
  
  let marketsCreated = 0;
  let marketsUpdated = 0;
  let timeSeriesInserted = 0;
  let errors = 0;
  const errorDetails: any[] = [];
  
  for (const [index, record] of recordsToProcess.entries()) {
    try {
      // Extract metadata columns
      const regionId = record.RegionID;
      const regionName = record.RegionName;
      const regionType = record.RegionType === 'msa' ? 'msa' : record.RegionType;
      const stateName = record.StateName || null;
      const sizeRank = record.SizeRank ? parseInt(record.SizeRank) : null;
      
      if (!regionId || !regionName) {
        console.warn(`⚠️ Skipping row ${index}: missing RegionID or RegionName`);
        continue;
      }
      
      // Progress indicator
      if ((index + 1) % 10 === 0) {
        console.log(`  Processing region ${index + 1}/${recordsToProcess.length}: ${regionName}`);
      }
      
      // Step 1: Upsert market record
      const marketData: MarketRecord = {
        region_id: regionId,
        region_name: regionName,
        region_type: regionType,
        state_name: stateName || undefined,
        state_code: stateName ? stateName.substring(0, 2).toUpperCase() : undefined,
        size_rank: sizeRank || undefined
      };
      
      const { data: marketResult, error: marketError } = await supabase
        .from('markets')
        .upsert(marketData, {
          onConflict: 'region_id',
          ignoreDuplicates: false
        })
        .select();
      
      if (marketError) {
        console.error(`❌ Error upserting market ${regionId}:`, marketError);
        errors++;
        errorDetails.push({
          region: regionId,
          error: marketError.message,
          type: 'market_upsert'
        });
        continue;
      }
      
      marketsCreated++;
      
      // Step 2: Extract and insert time series data
      const timeSeriesData: TimeSeriesRecord[] = [];
      
      // Get all date columns (format: YYYY-MM-DD)
      const dateColumns = Object.keys(record).filter(key => 
        /^\d{4}-\d{2}-\d{2}$/.test(key)
      );
      
      // Log date columns found
      if (index === 0) {
        console.log(`Found ${dateColumns.length} date columns`);
        console.log(`First few dates: ${dateColumns.slice(0, 3).join(', ')}`);
        console.log(`Last few dates: ${dateColumns.slice(-3).join(', ')}`);
      }
      
      // Process each date column
      for (const dateCol of dateColumns) {
        const value = parseFloat(record[dateCol]);
        
        // Skip null/empty values
        if (!isNaN(value) && value !== null && value !== 0) {
          timeSeriesData.push({
            region_id: regionId,
            date: dateCol,
            metric_name: metricName,
            metric_value: value,
            data_source: 'zillow',
            attributes: {
              property_type: 'sfrcondo',
              tier: 'middle'
            }
          });
        }
      }
      
      // Insert time series data in batches
      if (timeSeriesData.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < timeSeriesData.length; i += batchSize) {
          const batch = timeSeriesData.slice(i, i + batchSize);
          
          try {
            const { data: tsResult, error: tsError } = await supabase
              .from('market_time_series')
              .upsert(batch, {
                onConflict: 'region_id,date,metric_name,data_source,attributes',
                ignoreDuplicates: false
              })
              .select();
            
            if (tsError) {
              console.error(`❌ Error upserting time series batch for ${regionId}:`, tsError.message);
              errors++;
              errorDetails.push({
                region: regionId,
                error: tsError.message,
                type: 'time_series_upsert',
                batchSize: batch.length
              });
            } else {
              const insertedCount = tsResult?.length || batch.length;
              timeSeriesInserted += insertedCount;
            }
          } catch (err: any) {
            console.error(`❌ Exception during upsert for ${regionId}:`, err.message);
            errors++;
          }
        }
      }
      
    } catch (error: any) {
      console.error(`❌ Error processing region ${index}:`, error.message);
      errors++;
      errorDetails.push({
        index,
        error: error.message,
        type: 'processing'
      });
    }
  }
  
  // Summary
  console.log('\n📊 Import Summary');
  console.log('================');
  console.log(`✅ Markets created/updated: ${marketsCreated}`);
  console.log(`✅ Time series records inserted: ${timeSeriesInserted}`);
  if (errors > 0) {
    console.log(`❌ Errors: ${errors}`);
    if (errorDetails.length > 0 && errorDetails.length <= 10) {
      console.log('\nError details:');
      errorDetails.forEach((detail, idx) => {
        console.log(`  ${idx + 1}. ${JSON.stringify(detail)}`);
      });
    }
  }
  
  // Log to data_ingestion_logs if table exists
  try {
    await supabase
      .from('data_ingestion_logs')
      .insert({
        source: 'zillow',
        dataset: metricName,
        status: errors > 0 ? 'partial' : 'success',
        records_processed: recordsToProcess.length,
        records_inserted: timeSeriesInserted,
        records_updated: marketsUpdated,
        error_message: errors > 0 ? `${errors} errors occurred during import` : null,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });
  } catch (logError) {
    // Ignore logging errors
    console.warn('⚠️ Could not log to data_ingestion_logs table');
  }
  
  return {
    success: errors === 0,
    marketsCreated,
    timeSeriesInserted,
    errors,
    errorDetails
  };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  let filePath: string | undefined;
  let metricName = 'zhvi';
  let limitRows: number | undefined;
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--file' || arg === '-f') {
      filePath = args[++i];
    } else if (arg === '--metric' || arg === '-m') {
      metricName = args[++i];
    } else if (arg === '--limit' || arg === '-l') {
      limitRows = parseInt(args[++i]);
    }
  }
  
  if (!filePath) {
    console.error('❌ Please specify a file path');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/import-zillow-from-file.ts --file <path> [--metric <name>] [--limit <number>]');
    console.log('\nExamples:');
    console.log('  npx tsx scripts/import-zillow-from-file.ts --file data/zillow/zhvi-metro-all-homes-sm-sa.csv');
    console.log('  npx tsx scripts/import-zillow-from-file.ts --file data/zillow/zhvi-metro-all-homes-sm-sa.csv --limit 5');
    process.exit(1);
  }
  
  // Resolve file path
  const resolvedPath = join(process.cwd(), filePath);
  
  try {
    const result = await importZillowFromFile(resolvedPath, metricName, limitRows);
    
    if (result.success) {
      console.log('\n✅ Import completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️ Import completed with errors');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

