/**
 * Zillow Data Importer V2
 * Aligned with new database schema (markets and market_time_series tables)
 */

import axios from 'axios'
import { parse as parseSync } from 'csv-parse/sync'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// Zillow CSV URLs
const ZILLOW_URLS: Record<string, string> = {
  zhvi: 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  zori: 'https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  inventory: 'https://files.zillowstatic.com/research/public_csvs/invt_fs/Metro_invt_fs_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  daysOnMarket: 'https://files.zillowstatic.com/research/public_csvs/dom/Metro_dom_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  priceCuts: 'https://files.zillowstatic.com/research/public_csvs/price_cuts/Metro_price_cuts_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv'
}

interface MarketRecord {
  region_id: string
  region_name: string
  region_type: string
  state_name?: string
  state_code?: string
  size_rank?: number
}

interface TimeSeriesRecord {
  region_id: string
  date: string
  metric_name: string
  metric_value: number
  data_source: string
  property_type?: string
  tier?: string
}

/**
 * Import Zillow data into the new schema
 */
export async function importZillowData(
  metricName: string = 'zhvi',
  limitRows?: number
) {
  const supabase = createSupabaseAdminClient()
  
  console.log(`\n📊 Starting Zillow import for: ${metricName}`)
  console.log('================================================')
  
  // Download CSV
  const url = ZILLOW_URLS[metricName]
  if (!url) {
    throw new Error(`Unknown metric: ${metricName}`)
  }
  
  console.log(`📥 Downloading from: ${url}`)
  const response = await axios.get(url, {
    timeout: 30000,
    maxContentLength: 50 * 1024 * 1024
  })
  
  console.log(`✅ Downloaded ${(response.data.length / 1024).toFixed(1)} KB`)
  
  // Parse CSV
  const records: any[] = parseSync(response.data, {
    columns: true,
    skip_empty_lines: true
  })
  
  console.log(`📋 Parsed ${records.length} regions`)
  
  // Limit rows if specified (for testing)
  const recordsToProcess = limitRows ? records.slice(0, limitRows) : records
  console.log(`🔄 Processing ${recordsToProcess.length} regions`)
  
  let marketsCreated = 0
  let marketsUpdated = 0
  let timeSeriesInserted = 0
  let errors = 0
  
  for (const [index, record] of recordsToProcess.entries()) {
    try {
      // Extract metadata columns
      const regionId = record.RegionID
      const regionName = record.RegionName
      const regionType = record.RegionType === 'msa' ? 'msa' : record.RegionType
      const stateName = record.StateName || null
      const sizeRank = record.SizeRank ? parseInt(record.SizeRank) : null
      
      if (!regionId || !regionName) {
        console.warn(`⚠️ Skipping row ${index}: missing RegionID or RegionName`)
        continue
      }
      
      // Progress indicator
      if ((index + 1) % 10 === 0) {
        console.log(`  Processing region ${index + 1}/${recordsToProcess.length}: ${regionName}`)
      }
      
      // Step 1: Upsert market record
      const marketData: MarketRecord = {
        region_id: regionId,
        region_name: regionName,
        region_type: regionType,
        state_name: stateName || undefined,
        state_code: stateName ? stateName.substring(0, 2).toUpperCase() : undefined,
        size_rank: sizeRank || undefined
      }
      
      const { error: marketError } = await supabase
        .from('markets')
        .upsert(marketData, {
          onConflict: 'region_id',
          ignoreDuplicates: false
        })
      
      if (marketError) {
        console.error(`❌ Error upserting market ${regionId}:`, marketError.message)
        errors++
        continue
      }
      
      marketsCreated++
      
      // Step 2: Extract and insert time series data
      const timeSeriesData: TimeSeriesRecord[] = []
      
      // Get all date columns (format: YYYY-MM-DD)
      const dateColumns = Object.keys(record).filter(key => 
        /^\d{4}-\d{2}-\d{2}$/.test(key)
      )
      
      // Process each date column
      for (const dateCol of dateColumns) {
        const value = parseFloat(record[dateCol])
        
        // Skip null/empty values
        if (!isNaN(value) && value !== null) {
          timeSeriesData.push({
            region_id: regionId,
            date: dateCol,
            metric_name: metricName,
            metric_value: value,
            data_source: 'zillow',
            property_type: 'sfrcondo', // From the filename
            tier: 'middle' // 0.33_0.67 tier
          })
        }
      }
      
      // Insert time series data in batches
      if (timeSeriesData.length > 0) {
        const batchSize = 100
        for (let i = 0; i < timeSeriesData.length; i += batchSize) {
          const batch = timeSeriesData.slice(i, i + batchSize)
          
          const { error: tsError } = await supabase
            .from('market_time_series')
            .upsert(batch, {
              onConflict: 'region_id,date,metric_name,data_source,property_type,tier',
              ignoreDuplicates: true
            })
          
          if (tsError) {
            console.error(`❌ Error inserting time series batch:`, tsError.message)
            errors++
          } else {
            timeSeriesInserted += batch.length
          }
        }
      }
      
    } catch (error: any) {
      console.error(`❌ Error processing region ${index}:`, error.message)
      errors++
    }
  }
  
  // Summary
  console.log('\n📊 Import Summary')
  console.log('================')
  console.log(`✅ Markets created/updated: ${marketsCreated}`)
  console.log(`✅ Time series records inserted: ${timeSeriesInserted}`)
  if (errors > 0) {
    console.log(`❌ Errors: ${errors}`)
  }
  
  // Log to data_ingestion_logs
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
    })
  
  return {
    success: errors === 0,
    marketsCreated,
    timeSeriesInserted,
    errors,
    message: `Imported ${metricName} data: ${marketsCreated} markets, ${timeSeriesInserted} time series records`
  }
}

/**
 * Import all Zillow metrics
 */
export async function importAllZillowData(limitRows?: number) {
  const metrics = ['zhvi', 'zori', 'inventory', 'daysOnMarket', 'priceCuts']
  const results = []
  
  for (const metric of metrics) {
    console.log(`\n🔄 Importing ${metric}...`)
    const result = await importZillowData(metric, limitRows)
    results.push(result)
    
    // Add delay between imports to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  return results
}

/**
 * Test import with limited data
 */
export async function testZillowImport() {
  console.log('🧪 Running test import with 5 regions...')
  return await importZillowData('zhvi', 5)
}
