/**
 * Simplified Zillow Data Fetcher (without Puppeteer)
 * For testing purposes - uses direct CSV URLs
 */

import axios from 'axios'
import { parse as parseSync } from 'csv-parse/sync'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// Direct Zillow CSV URLs (these are public and stable)
const ZILLOW_URLS: Record<string, string> = {
  zhvi: 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  zori: 'https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  inventory: 'https://files.zillowstatic.com/research/public_csvs/invt_fs/Metro_invt_fs_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  daysOnMarket: 'https://files.zillowstatic.com/research/public_csvs/dom/Metro_dom_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  priceCuts: 'https://files.zillowstatic.com/research/public_csvs/price_cuts/Metro_price_cuts_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv'
}

interface TimeSeriesData {
  geo_code: string
  date: string
  metric_name: string
  value: number
  source: string
}

export async function fetchZillowDataSimple(
  datasets: string[] = ['zhvi']
): Promise<TimeSeriesData[]> {
  const allData: TimeSeriesData[] = []
  
  for (const dataset of datasets) {
    try {
      console.log(`📥 Fetching ${dataset}...`)
      
      const url = ZILLOW_URLS[dataset]
      if (!url) {
        console.warn(`Unknown dataset: ${dataset}`)
        continue
      }
      
      // Download CSV with timeout
      const response = await axios.get(url, {
        timeout: 30000, // 30 seconds
        maxContentLength: 50 * 1024 * 1024 // 50MB max
      })
      
      console.log(`✅ Downloaded ${dataset}, size: ${response.data.length} bytes`)
      
      // Parse CSV
      const records = parseSync(response.data, {
        columns: true,
        skip_empty_lines: true
      })
      
      console.log(`📊 Parsed ${records.length} records from ${dataset}`)
      
      // Process only first 10 records for testing
      const testRecords = records.slice(0, 10)
      
      for (const record of testRecords) {
        // Extract region info
        const regionName = record.RegionName || record.Metro || ''
        const regionType = record.RegionType || 'metro'
        
        // Generate a temporary geo_code for testing
        const geo_code = `temp_${regionType}_${regionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
        
        // Get date columns (all columns that look like dates: YYYY-MM-DD)
        const dateColumns = Object.keys(record).filter(key => 
          /^\d{4}-\d{2}-\d{2}$/.test(key)
        )
        
        // Process only last 3 months for testing
        const recentDates = dateColumns.slice(-3)
        
        for (const dateCol of recentDates) {
          const value = parseFloat(record[dateCol])
          if (!isNaN(value)) {
            allData.push({
              geo_code,
              date: dateCol,
              metric_name: dataset,
              value,
              source: 'zillow'
            })
          }
        }
      }
      
      console.log(`✅ Processed ${dataset}: ${allData.length} data points total`)
      
    } catch (error: any) {
      console.error(`❌ Error fetching ${dataset}:`, error.message)
      // Continue with other datasets
    }
  }
  
  return allData
}

export async function storeZillowDataSimple(dataPoints: TimeSeriesData[]): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  
  // Store in batches of 100
  const batchSize = 100
  let stored = 0
  
  for (let i = 0; i < dataPoints.length; i += batchSize) {
    const batch = dataPoints.slice(i, i + batchSize)
    
    const { error } = await adminClient
      .from('time_series_data')
      .insert(batch)
    
    if (error) {
      console.error(`❌ Error storing batch:`, error)
      throw error
    }
    
    stored += batch.length
    console.log(`💾 Stored ${stored}/${dataPoints.length} records`)
  }
  
  console.log(`✅ Successfully stored all ${dataPoints.length} records`)
}
