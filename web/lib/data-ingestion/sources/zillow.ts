/**
 * Zillow Data Fetcher
 * Downloads and parses CSV files from Zillow Research Data
 * Uses Puppeteer as fallback for dynamic URLs
 */

import puppeteer from 'puppeteer'
import { parse } from 'csv-parse'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { mapZillowRegionToGeoCode, generateTempGeoCode } from '../utils/geo-mapping'
import { validateBatch, logDataQuality, validateDataPoint } from '../validators/data-quality'

export interface ZillowDataPoint {
  geo_code: string
  date: string
  home_value?: number
  rent_for_apartments?: number
  rent_for_houses?: number
  days_on_market?: number
  total_active_inventory?: number
  price_cuts_count?: number
}

/**
 * Zillow Research Data URLs
 * These may change, so we use Puppeteer to find current URLs
 */
const ZILLOW_BASE_URL = 'https://www.zillow.com/research/data/'

/**
 * Known Zillow dataset URLs (fallback if direct access works)
 */
const ZILLOW_DATASETS = {
  zhvi: 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  zori: 'https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  inventory: 'https://files.zillowstatic.com/research/public_csvs/invt_fs/Metro_invt_fs_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  daysOnMarket: 'https://files.zillowstatic.com/research/public_csvs/dom/Metro_dom_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  priceCuts: 'https://files.zillowstatic.com/research/public_csvs/price_cuts/Metro_price_cuts_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv'
}

/**
 * Use Puppeteer to find current CSV download URLs from Zillow Research page
 */
async function findZillowCSVUrls(): Promise<Record<string, string>> {
  console.log('🔍 Finding Zillow CSV URLs using Puppeteer...')
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    await page.goto(ZILLOW_BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 })

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Extract CSV download links
    const csvUrls = await page.evaluate(() => {
      const links: Record<string, string> = {}
      const anchorTags = document.querySelectorAll('a[href*=".csv"], a[href*="research/public_csvs"]')

      anchorTags.forEach((link) => {
        const href = (link as HTMLAnchorElement).href
        const text = link.textContent?.toLowerCase() || ''

        // Categorize by dataset type
        if (href.includes('zhvi') || text.includes('home value')) {
          links.zhvi = href
        } else if (href.includes('zori') || text.includes('rent')) {
          links.zori = href
        } else if (href.includes('invt') || text.includes('inventory')) {
          links.inventory = href
        } else if (href.includes('dom') || text.includes('days on market')) {
          links.daysOnMarket = href
        } else if (href.includes('price_cuts') || text.includes('price cut')) {
          links.priceCuts = href
        }
      })

      return links
    })

    console.log('✅ Found CSV URLs:', Object.keys(csvUrls))
    return csvUrls
  } catch (error) {
    console.error('❌ Error finding CSV URLs:', error)
    // Fall back to known URLs
    console.log('⚠️ Falling back to known URLs')
    return ZILLOW_DATASETS
  } finally {
    await browser.close()
  }
}

/**
 * Download CSV file from URL
 */
async function downloadCSV(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    throw new Error(`Error downloading CSV from ${url}: ${error}`)
  }
}

/**
 * Parse Zillow CSV and convert to standardized format
 */
async function parseZillowCSV(csvText: string, datasetType: string): Promise<ZillowDataPoint[]> {
  try {
    // Use csv-parse sync API for simplicity
    const { parse: parseSync } = await import('csv-parse/sync')
    const records = parseSync(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true
    }) as any[]

    const dataPoints: ZillowDataPoint[] = []

    for (const record of records) {
      // Zillow CSV format: RegionName, StateName, dates as columns (YYYY-MM-DD)
      const regionName = record.RegionName || record.Name || ''
      const stateCode = record.StateName || record.State || ''
      
      if (!regionName || !stateCode) continue

      // Map to geo_code (try database first, then generate temp)
      let geoCode = await mapZillowRegionToGeoCode(regionName, stateCode, 'metro')
      if (!geoCode) {
        geoCode = generateTempGeoCode(regionName, stateCode, 'metro')
        console.warn(`⚠️ Using temp geo_code for unmapped region: ${regionName}`)
      }

      // Extract date columns (format: YYYY-MM-DD)
      const dateColumns = Object.keys(record).filter(key => 
        /^\d{4}-\d{2}-\d{2}$/.test(key)
      )

      for (const dateCol of dateColumns) {
        const value = parseFloat(record[dateCol])
        if (isNaN(value) || value === 0) continue

        const dataPoint: ZillowDataPoint = {
          geo_code: geoCode,
          date: dateCol
        }

        // Map value to appropriate field based on dataset type
        switch (datasetType) {
          case 'zhvi':
            dataPoint.home_value = value
            break
          case 'zori':
            // ZORI has both apartment and house rents - we'll need to parse both
            dataPoint.rent_for_apartments = value
            dataPoint.rent_for_houses = value // Zillow combines them, we'll split later
            break
          case 'inventory':
            dataPoint.total_active_inventory = Math.round(value)
            break
          case 'daysOnMarket':
            dataPoint.days_on_market = value
            break
          case 'priceCuts':
            dataPoint.price_cuts_count = Math.round(value)
            break
        }

        dataPoints.push(dataPoint)
      }
    }

    return dataPoints
  } catch (error) {
    throw new Error(`Error parsing CSV: ${error}`)
  }
}


/**
 * Main function to fetch Zillow data
 */
export async function fetchZillowData(
  datasetTypes: string[] = ['zhvi', 'zori', 'inventory', 'daysOnMarket', 'priceCuts']
): Promise<ZillowDataPoint[]> {
  console.log('📥 Fetching Zillow data for:', datasetTypes)

  const allDataPoints: ZillowDataPoint[] = []

  try {
    // Find current CSV URLs
    const csvUrls = await findZillowCSVUrls()

    // Download and parse each dataset
    for (const datasetType of datasetTypes) {
      const url = csvUrls[datasetType] || ZILLOW_DATASETS[datasetType as keyof typeof ZILLOW_DATASETS]

      if (!url) {
        console.warn(`⚠️ No URL found for dataset: ${datasetType}`)
        continue
      }

      console.log(`📥 Downloading ${datasetType} from: ${url}`)
      const csvText = await downloadCSV(url)
      console.log(`✅ Downloaded ${csvText.length} characters`)

      const dataPoints = await parseZillowCSV(csvText, datasetType)
      console.log(`✅ Parsed ${dataPoints.length} data points from ${datasetType}`)

      // Validate data quality
      const qualityReport = validateBatch(dataPoints)
      console.log(`📊 Quality: ${qualityReport.validRecords}/${qualityReport.totalRecords} valid`)
      
      if (qualityReport.invalidRecords > 0) {
        console.warn(`⚠️ ${qualityReport.invalidRecords} invalid records found`)
      }

      // Log quality report
      await logDataQuality(`zillow-${datasetType}`, qualityReport)

      // Only add valid data points
      const validPoints = dataPoints.filter((_, index) => {
        const validation = validateDataPoint(dataPoints[index])
        return validation.valid
      })

      allDataPoints.push(...validPoints)
    }

    console.log(`✅ Total data points fetched: ${allDataPoints.length}`)
    return allDataPoints
  } catch (error) {
    console.error('❌ Error fetching Zillow data:', error)
    throw error
  }
}

/**
 * Store Zillow data in database
 */
export async function storeZillowData(dataPoints: ZillowDataPoint[]): Promise<void> {
  const supabase = createSupabaseAdminClient()

  // Group by date for batch insert
  const byDate = new Map<string, ZillowDataPoint[]>()

  for (const point of dataPoints) {
    const key = `${point.geo_code}-${point.date}`
    if (!byDate.has(key)) {
      byDate.set(key, [])
    }
    byDate.get(key)!.push(point)
  }

  // Merge data points for same geo_code + date
  const merged: Record<string, Partial<ZillowDataPoint & { data_source: string }>> = {}

  for (const [key, points] of byDate.entries()) {
    const [geoCode, date] = key.split('-', 2)
    merged[key] = {
      geo_code: geoCode,
      date: date,
      data_source: 'zillow'
    }

    for (const point of points) {
      Object.assign(merged[key], point)
    }
  }

  // Insert into time_series_data
  const records = Object.values(merged).map(point => ({
    geo_code: point.geo_code!,
    date: point.date!,
    home_value: point.home_value,
    rent_for_apartments: point.rent_for_apartments,
    rent_for_houses: point.rent_for_houses,
    days_on_market: point.days_on_market,
    total_active_inventory: point.total_active_inventory,
    price_cuts_count: point.price_cuts_count,
    data_source: 'zillow'
  }))

  const { error } = await supabase
    .from('time_series_data')
    .upsert(records, {
      onConflict: 'geo_code,date'
    })

  if (error) {
    throw new Error(`Failed to store Zillow data: ${error.message}`)
  }

  console.log(`✅ Stored ${records.length} records in database`)
}

