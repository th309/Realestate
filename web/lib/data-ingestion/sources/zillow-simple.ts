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

// Simple geo code mapping function (no external imports)
async function mapToGeoCode(regionName: string, regionType: string): Promise<string> {
  console.log(`[mapToGeoCode] Called with: regionName=${regionName}, regionType=${regionType}`)
  
  // For now, just generate a temporary geo code
  // This avoids any import issues while we test the data flow
  const sanitized = regionName.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const geo_code = `temp_${regionType}_${sanitized}`
  
  console.log(`[mapToGeoCode] Generated temp geo_code: ${geo_code}`)
  return geo_code
}

export async function fetchZillowDataSimple(
  datasets: string[] = ['zhvi']
): Promise<TimeSeriesData[]> {
  console.log('[fetchZillowDataSimple] Starting with datasets:', datasets)
  
  const allData: TimeSeriesData[] = []
  
  for (const dataset of datasets) {
    try {
      console.log(`📥 Fetching ${dataset}...`)
      console.log(`[fetchZillowDataSimple] Processing dataset: ${dataset}`)
      
      const url = ZILLOW_URLS[dataset]
      if (!url) {
        console.warn(`Unknown dataset: ${dataset}`)
        continue
      }
      
      // Download CSV with timeout
      console.log(`[fetchZillowDataSimple] Downloading from URL: ${url}`)
      const response = await axios.get(url, {
        timeout: 30000, // 30 seconds
        maxContentLength: 50 * 1024 * 1024 // 50MB max
      })
      
      console.log(`✅ Downloaded ${dataset}, size: ${response.data.length} bytes`)
      
      // Parse CSV
      console.log('Parsing CSV data...')
      const records: any[] = parseSync(response.data, {
        columns: true,
        skip_empty_lines: true
      })
      console.log(`Parsed ${records.length} records`)
      
      // Process all records (or limit for testing)
      const LIMIT_RECORDS = 50 // Increase from 10 to 50 for more thorough testing
      const testRecords = records.slice(0, LIMIT_RECORDS)
      
      for (const [index, record] of testRecords.entries()) {
        if (index % 10 === 0) {
          console.log(`[fetchZillowDataSimple] Processing record ${index + 1}/${testRecords.length}`)
        }
        
        // Extract region info
        const regionName = (record as any).RegionName || (record as any).Metro || ''
        const regionType = (record as any).RegionType || 'metro'
        console.log(`[fetchZillowDataSimple] Record ${index}: region=${regionName}, type=${regionType}`)
        
        // Map to actual geo_code or generate temporary one
        let geo_code
        try {
          console.log(`[fetchZillowDataSimple] Attempting to map: ${regionName}, ${regionType}`)
          geo_code = await mapToGeoCode(regionName, regionType)
          console.log(`[fetchZillowDataSimple] Mapped to geo_code: ${geo_code}`)
        } catch (mapError) {
          console.error(`[fetchZillowDataSimple] Mapping error for ${regionName}:`, mapError)
          geo_code = `temp_${regionType}_${regionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
          console.log(`[fetchZillowDataSimple] Using fallback geo_code: ${geo_code}`)
        }
        
        // Get date columns (all columns that look like dates: YYYY-MM-DD)
        const dateColumns = Object.keys(record as any).filter(key => 
          /^\d{4}-\d{2}-\d{2}$/.test(key)
        )
        
        // Process last 12 months for better data coverage
        const recentDates = dateColumns.slice(-12)
        
        for (const dateCol of recentDates) {
          const value = parseFloat((record as any)[dateCol])
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
      console.error(`[fetchZillowDataSimple] Full error for ${dataset}:`, error)
      console.error(`[fetchZillowDataSimple] Stack trace:`, error.stack)
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
