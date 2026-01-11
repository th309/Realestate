/**
 * Redfin Data Center Importer
 * Imports housing market data from Redfin Data Center CSV files
 * Uses Puppeteer to intercept automatic downloads from Redfin's Data Center
 * Creates new market records if they don't exist (following Census pattern)
 *
 * This file has been refactored to use modular components from ./redfin/
 */

import { parse as parseSync } from 'csv-parse/sync'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// Import types, constants, and utilities from modular components
import type {
  MarketRecord,
  TimeSeriesRecord,
  DiscoveredDataset,
  ImportResult,
  ImportAllResult,
  ProgressCallback
} from './redfin/types'

import {
  REDFIN_DATA_CENTER_URL,
  REDFIN_DATASET_CATEGORIES,
  REDFIN_DATASETS
} from './redfin/constants'

import {
  mapRedfinRegionToRegionId,
  createMarketFromRedfinData,
  getRegionCacheKey,
  cleanUtf16CsvData,
  parseCsvLine
} from './redfin/utils'

import { discoverRedfinDatasets } from './redfin/discovery'
import { downloadRedfinCSV } from './redfin/downloader'

// Re-export everything for backward compatibility
export type { MarketRecord, TimeSeriesRecord, DiscoveredDataset, ImportResult, ImportAllResult, ProgressCallback }
export { REDFIN_DATA_CENTER_URL, REDFIN_DATASET_CATEGORIES, REDFIN_DATASETS }
export { mapRedfinRegionToRegionId, createMarketFromRedfinData, getRegionCacheKey, cleanUtf16CsvData, parseCsvLine }
export { discoverRedfinDatasets, downloadRedfinCSV }

/**
 * Import all available Redfin datasets
 */
export async function importAllRedfinData(limitRows?: number): Promise<ImportAllResult> {
  console.log('\n📊 Starting import of ALL Redfin datasets...')
  console.log('================================================')

  const datasets = await discoverRedfinDatasets()

  if (datasets.length === 0) {
    throw new Error('No datasets found on Redfin Data Center page')
  }

  console.log(`\n✅ Found ${datasets.length} datasets to import:`)
  datasets.forEach((ds, idx) => {
    console.log(`  ${idx + 1}. [${ds.category}] ${ds.description}`)
  })

  const results: Array<{
    dataset: string
    success: boolean
    marketsCreated: number
    timeSeriesInserted: number
    errors: number
  }> = []

  for (const dataset of datasets) {
    try {
      const metricName = dataset.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')

      console.log(`\n📥 Importing: ${dataset.description} (${dataset.category})`)

      const result = await importRedfinData(metricName, limitRows, undefined, dataset.url)

      results.push({
        dataset: dataset.description,
        success: result.success,
        marketsCreated: result.details.marketsCreated,
        timeSeriesInserted: result.details.timeSeriesInserted,
        errors: result.details.errors
      })

      await new Promise(resolve => setTimeout(resolve, 2000))

    } catch (error: any) {
      console.error(`❌ Error importing ${dataset.description}:`, error.message)
      results.push({
        dataset: dataset.description,
        success: false,
        marketsCreated: 0,
        timeSeriesInserted: 0,
        errors: 1
      })
    }
  }

  const totalMarkets = results.reduce((sum, r) => sum + r.marketsCreated, 0)
  const totalRecords = results.reduce((sum, r) => sum + r.timeSeriesInserted, 0)
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
  const successful = results.filter(r => r.success).length

  console.log('\n📊 Import Summary')
  console.log('================')
  console.log(`✅ Successfully imported: ${successful}/${datasets.length} datasets`)
  console.log(`✅ Total markets created: ${totalMarkets}`)
  console.log(`✅ Total time series records: ${totalRecords}`)
  if (totalErrors > 0) {
    console.log(`❌ Total errors: ${totalErrors}`)
  }

  return {
    success: totalErrors === 0,
    message: `Imported ${successful}/${datasets.length} datasets: ${totalMarkets} markets, ${totalRecords} records`,
    details: {
      datasetsProcessed: datasets.length,
      datasetsSuccessful: successful,
      totalMarketsCreated: totalMarkets,
      totalTimeSeriesInserted: totalRecords,
      totalErrors,
      results
    }
  }
}

/**
 * Import Redfin data from CSV
 */
export async function importRedfinData(
  metricName: string = 'median_sale_price',
  limitRows?: number,
  csvContent?: string,
  downloadUrl?: string,
  onProgress?: ProgressCallback,
  sourceFileName?: string
): Promise<ImportResult> {
  let supabase
  try {
    supabase = createSupabaseAdminClient()
    console.log('✅ Supabase client created successfully')

    console.log('🔍 Testing database connection...')
    const { error: testError } = await supabase
      .from('markets')
      .select('region_id')
      .limit(1)

    if (testError) {
      console.error('❌ Database connection test failed:', testError.message)
      throw new Error(`Database connection test failed: ${testError.message}`)
    }
    console.log('✅ Database connection test passed')
  } catch (error: any) {
    console.error('❌ Failed to create/connect Supabase client:', error.message)
    throw new Error(`Database connection failed: ${error.message}`)
  }

  const regionCache = new Map<string, string>()

  console.log(`\n📊 Starting Redfin import for: ${metricName}`)
  console.log('================================================')

  let csvData: string

  try {
    if (csvContent) {
      console.log(`📋 Using provided CSV content`)
      csvData = csvContent
    } else {
      csvData = await downloadRedfinCSV(metricName, downloadUrl)
    }

    // Clean UTF-16 encoding if needed
    csvData = cleanUtf16CsvData(csvData)

    // Parse CSV/TSV
    const isTSV = csvData.includes('\t') || metricName.includes('tsv')

    let records: any[] = []
    try {
      records = parseSync(csvData, {
        columns: true,
        skip_empty_lines: true,
        skip_records_with_error: true,
        relax_column_count: true,
        relax_quotes: true,
        delimiter: isTSV ? '\t' : ',',
        trim: true,
        cast: false
      })
    } catch (parseError: any) {
      console.warn(`⚠️ CSV parsing encountered issues: ${parseError.message}`)
      console.warn('   Attempting to continue with valid rows only...')

      if (parseError.message.includes('Invalid Record Length') || parseError.message.includes('columns length')) {
        console.log('   Using fallback parser to handle inconsistent row lengths...')
        const lines = csvData.split(/\r?\n/).filter(line => line.trim())
        if (lines.length < 2) {
          throw new Error('CSV file appears to be empty or has no data rows')
        }

        const headers = parseCsvLine(lines[0])
        console.log(`   Found ${headers.length} columns: ${headers.join(', ')}`)

        records = []
        let skippedRows = 0
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          const values = parseCsvLine(line)

          if (values.length > 0 && values.some(v => v && v.trim())) {
            const record: any = {}
            headers.forEach((header, idx) => {
              if (values[idx] !== undefined) {
                record[header] = values[idx]
              }
            })
            if (Object.keys(record).length > 0) {
              records.push(record)
            } else {
              skippedRows++
            }
          } else {
            skippedRows++
          }
        }
        console.log(`   Recovered ${records.length} valid records from ${lines.length - 1} lines (skipped ${skippedRows} empty/invalid rows)`)
      } else {
        throw new Error(`Failed to parse CSV: ${parseError.message}`)
      }
    }

    // Filter out empty records
    const validRecords = records.filter(record => {
      if (!record || typeof record !== 'object') return false
      const values = Object.values(record)
      return values.some(val => val !== null && val !== undefined && val !== '' && val !== '""')
    })

    if (validRecords.length < records.length) {
      console.log(`   Filtered out ${records.length - validRecords.length} empty/invalid records`)
    }

    records = validRecords

    console.log(`📋 Parsed ${records.length} records`)

    // Clean column names and values
    const cleanedRecords = records.map(record => {
      const cleaned: any = {}
      for (const [key, value] of Object.entries(record)) {
        const cleanKey = key.replace(/\u0000/g, '').replace(/[\uFFFE\uFEFF]/g, '').trim()
        const cleanValue = typeof value === 'string'
          ? value.replace(/\u0000/g, '').replace(/[\uFFFE\uFEFF]/g, '').trim()
          : value
        cleaned[cleanKey] = cleanValue
      }
      return cleaned
    })

    records = cleanedRecords
    const firstRecord = cleanedRecords[0] || {}
    const allColumns = Object.keys(firstRecord)

    // Analyze CSV structure
    const dateColumns = allColumns.filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key))
    const hasDateColumns = dateColumns.length > 0

    console.log(`📊 CSV Analysis:`)
    console.log(`   Total columns: ${allColumns.length}`)
    console.log(`   Date columns found: ${dateColumns.length}`)

    // Find region and date columns
    const regionColumn = allColumns.find(col => {
      const lowerCol = col.toLowerCase()
      return (lowerCol === 'region' || lowerCol === 'state') &&
        !lowerCol.includes('_type') && !lowerCol.includes('type_') && !lowerCol.endsWith('type')
    }) || allColumns.find(col => {
      const lowerCol = col.toLowerCase()
      return (lowerCol.includes('region') || lowerCol.includes('area') ||
        lowerCol.includes('metro') || lowerCol.includes('city') || lowerCol.includes('state')) &&
        !lowerCol.includes('_type') && !lowerCol.includes('type_') && !lowerCol.endsWith('type')
    }) || allColumns[0]

    const hasRegionColumn = !!regionColumn && (
      regionColumn.toLowerCase().includes('region') ||
      regionColumn.toLowerCase().includes('area') ||
      regionColumn.toLowerCase().includes('metro') ||
      regionColumn.toLowerCase().includes('city') ||
      regionColumn.toLowerCase().includes('state')
    )

    const dateColumnName = allColumns.find(col => {
      const lowerCol = col.toLowerCase()
      return lowerCol.includes('date') || lowerCol.includes('month') ||
        lowerCol.includes('period') || lowerCol.includes('quarter') || lowerCol.includes('time')
    })

    // Identify metric columns
    const metricColumns = allColumns.filter(col => {
      const lowerCol = col.toLowerCase()
      if (col === regionColumn || col === dateColumnName) return false
      if (lowerCol.includes('region') ||
        (lowerCol.includes('date') && !lowerCol.includes('mom') && !lowerCol.includes('yoy')) ||
        (lowerCol.includes('month') && !lowerCol.includes('mom') && !lowerCol.includes('yoy')) ||
        (lowerCol.includes('period') && !lowerCol.includes('mom') && !lowerCol.includes('yoy')) ||
        (lowerCol.includes('quarter') && !lowerCol.includes('mom') && !lowerCol.includes('yoy')) ||
        lowerCol.includes('state') || lowerCol.includes('type')) {
        return false
      }
      return true
    })

    const isCrossTabFormat = !hasDateColumns && hasRegionColumn && dateColumnName && metricColumns.length > 0

    console.log(`   Format detected: ${isCrossTabFormat ? 'Cross Tab' : hasDateColumns ? 'Data (date columns)' : 'Unknown'}`)
    if (isCrossTabFormat) {
      console.log(`   Region column: ${regionColumn}`)
      console.log(`   Date column: ${dateColumnName}`)
      console.log(`   Metric columns: ${metricColumns.length}`)
    }

    // Process records
    let marketsCreated = 0
    let totalTimeSeriesInserted = 0
    let errors = 0
    const errorDetails: any[] = []
    let skippedNoRegion = 0
    let skippedNoDate = 0
    let skippedNoMetrics = 0

    const analysisResults = {
      format: isCrossTabFormat ? 'cross_tab' : hasDateColumns ? 'data' : 'unknown',
      regionColumn,
      dateColumnName,
      metricColumns: metricColumns.length,
      totalRecords: records.length
    }

    // Process in chunks
    const CHUNK_SIZE = 5000
    const totalChunks = Math.ceil(records.length / CHUNK_SIZE)

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const chunkStart = chunkIndex * CHUNK_SIZE
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, records.length)
      const chunk = records.slice(chunkStart, chunkEnd)

      console.log(`\n📦 Processing chunk ${chunkIndex + 1}/${totalChunks} (records ${chunkStart + 1}-${chunkEnd})...`)

      const chunkTimeSeriesData: TimeSeriesRecord[] = []

      for (let i = 0; i < chunk.length; i++) {
        const record = chunk[i]
        const index = chunkStart + i

        try {
          // Extract region info
          const regionName = record[regionColumn] || ''
          if (!regionName || regionName.trim() === '') {
            skippedNoRegion++
            continue
          }

          // Determine region type
          const regionTypeCol = allColumns.find(col => col.toLowerCase() === 'region_type')
          let regionType = regionTypeCol ? (record[regionTypeCol] || '').toLowerCase() : 'unknown'
          if (regionType === 'usa') regionType = 'national'
          else if (regionType === 'national') regionType = 'national'
          else if (regionType === 'state') regionType = 'state'
          else if (regionType.includes('metro') || regionType.includes('msa') || regionType.includes('cbsa')) regionType = 'msa'
          else if (regionType.includes('county')) regionType = 'county'
          else if (regionType.includes('city')) regionType = 'city'
          else if (regionType.includes('zip') || regionType.includes('postal')) regionType = 'zip'
          else regionType = 'msa'

          // Extract state code
          const stateCol = allColumns.find(col =>
            col.toLowerCase() === 'state_code' || col.toLowerCase() === 'state'
          )
          const stateCode = stateCol ? record[stateCol] : undefined

          // Get or create region_id
          const cacheKey = getRegionCacheKey(regionName, regionType, stateCode)
          let regionId = regionCache.get(cacheKey)

          if (!regionId) {
            regionId = await mapRedfinRegionToRegionId(supabase, regionName, regionType, stateCode) || undefined

            if (!regionId) {
              regionId = await createMarketFromRedfinData(
                supabase, regionName, regionType, undefined, stateCode
              ) || undefined

              if (regionId) {
                marketsCreated++
              }
            }

            if (!regionId) {
              console.warn(`⚠️ Could not create or map Redfin region: ${regionName}`)
              continue
            }

            regionCache.set(cacheKey, regionId)
          }

          // Extract time series data
          if (isCrossTabFormat) {
            const dateValue = record[dateColumnName!] || ''
            let parsedDate = parseDateValue(dateValue)

            if (!parsedDate) {
              skippedNoDate++
              continue
            }

            let hasValidMetrics = false
            for (const metricCol of metricColumns) {
              const rawValue = record[metricCol] || ''
              if (!rawValue || rawValue === '' || rawValue === '-' || rawValue === 'null') continue

              hasValidMetrics = true
              const value = parseMetricValue(rawValue, metricCol)

              if (value !== null) {
                const cleanMetricName = metricCol
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '_')
                  .replace(/^_+|_+$/g, '')

                const lowerCol = metricCol.toLowerCase()
                const isPercentage = lowerCol.includes('mom') || lowerCol.includes('yoy') ||
                  lowerCol.includes('month-over-month') || lowerCol.includes('year-over-year')

                chunkTimeSeriesData.push({
                  region_id: regionId,
                  date: parsedDate,
                  metric_name: cleanMetricName,
                  metric_value: value,
                  data_source: 'redfin',
                  attributes: {
                    region_type: regionType,
                    state_code: stateCode || undefined,
                    format: 'cross_tab',
                    original_column: metricCol,
                    is_percentage: isPercentage,
                    metric_type: isPercentage ? 'change' : 'value',
                    source_file: sourceFileName || undefined
                  }
                })
              }
            }

            if (!hasValidMetrics) {
              skippedNoMetrics++
            }
          } else {
            // Data format with date columns
            for (const dateCol of dateColumns) {
              const rawValue = record[dateCol]
              const value = typeof rawValue === 'string'
                ? parseFloat(rawValue.replace(/[,$]/g, ''))
                : parseFloat(rawValue)

              if (!isNaN(value) && value > 0) {
                chunkTimeSeriesData.push({
                  region_id: regionId,
                  date: dateCol,
                  metric_name: metricName,
                  metric_value: value,
                  data_source: 'redfin',
                  attributes: {
                    region_type: regionType,
                    state_code: stateCode || undefined,
                    source_file: sourceFileName || undefined
                  }
                })
              }
            }
          }
        } catch (error: any) {
          console.error(`❌ Error processing row ${index}:`, error.message)
          errors++
          errorDetails.push({ region: `Row ${index}`, error: error.message })
        }
      }

      // Insert chunk data
      if (chunkTimeSeriesData.length > 0) {
        console.log(`   Collected ${chunkTimeSeriesData.length} time series records from chunk ${chunkIndex + 1}`)

        // Deduplicate
        const uniqueTimeSeriesMap = new Map<string, TimeSeriesRecord>()
        for (const record of chunkTimeSeriesData) {
          const attrs = record.attributes || {}
          const attrParts: string[] = []
          if (attrs.region_type) attrParts.push(`rt:${attrs.region_type}`)
          if (attrs.state_code) attrParts.push(`sc:${attrs.state_code}`)
          if (attrs.format) attrParts.push(`fmt:${attrs.format}`)
          if (attrs.original_column) attrParts.push(`col:${attrs.original_column}`)
          if (attrs.is_percentage !== undefined) attrParts.push(`pct:${attrs.is_percentage}`)
          if (attrs.metric_type) attrParts.push(`mt:${attrs.metric_type}`)
          if (attrs.source_file) attrParts.push(`file:${attrs.source_file}`)
          const attrKey = attrParts.join('|')
          const uniqueKey = `${record.region_id}|${record.date}|${record.metric_name}|${record.data_source}|${attrKey}`
          uniqueTimeSeriesMap.set(uniqueKey, record)
        }

        const uniqueChunkData = Array.from(uniqueTimeSeriesMap.values())
        console.log(`   Deduplicated: ${chunkTimeSeriesData.length} -> ${uniqueChunkData.length} unique records`)

        // Insert in batches
        const batchSize = 2000
        const totalBatches = Math.ceil(uniqueChunkData.length / batchSize)

        for (let i = 0; i < uniqueChunkData.length; i += batchSize) {
          const batch = uniqueChunkData.slice(i, i + batchSize)
          const batchNum = Math.floor(i / batchSize) + 1

          if (onProgress && (batchNum % 5 === 0 || batchNum === totalBatches)) {
            const percent = Math.round((batchNum / totalBatches) * 100)
            onProgress(`Inserting batch ${batchNum}/${totalBatches}...`, { current: batchNum, total: totalBatches, percent })
          }

          try {
            const { error: tsError } = await supabase
              .from('market_time_series')
              .upsert(batch, {
                onConflict: 'region_id,date,metric_name,data_source,attributes',
                ignoreDuplicates: false
              })

            if (tsError) {
              console.error(`❌ Error upserting batch:`, tsError.message)
              errors++
            } else {
              totalTimeSeriesInserted += batch.length
            }
          } catch (fetchError: any) {
            console.error(`❌ Fetch error:`, fetchError.message)
            errors++
          }
        }

        console.log(`   ✅ Inserted ${uniqueChunkData.length} records from chunk ${chunkIndex + 1}`)
      }
    }

    console.log('\n📊 Redfin Import Summary')
    console.log('================')
    console.log(`✅ Markets created: ${marketsCreated}`)
    console.log(`✅ Time series records inserted: ${totalTimeSeriesInserted}`)
    if (errors > 0) {
      console.log(`❌ Errors: ${errors}`)
    }

    if (totalTimeSeriesInserted === 0) {
      console.warn('\n⚠️ WARNING: No time series records were imported!')
      console.warn(`   Skipped - Missing region: ${skippedNoRegion}`)
      console.warn(`   Skipped - Invalid date: ${skippedNoDate}`)
      console.warn(`   Skipped - No metrics: ${skippedNoMetrics}`)
    }

    return {
      success: errors === 0,
      message: `Imported Redfin data: ${marketsCreated} markets, ${totalTimeSeriesInserted} time series records`,
      details: {
        marketsCreated,
        timeSeriesInserted: totalTimeSeriesInserted,
        errors,
        skippedRows: skippedNoRegion + skippedNoDate + skippedNoMetrics,
        sourceFile: sourceFileName
      }
    }

  } catch (error: any) {
    console.error('❌ Error downloading or parsing Redfin data:', error.message)
    throw error
  }
}

/**
 * Import Redfin data from uploaded file
 */
export async function importRedfinDataFromFile(
  csvContent: string,
  metricName: string = 'median_sale_price',
  limitRows?: number,
  onProgress?: ProgressCallback,
  sourceFileName?: string
): Promise<ImportResult> {
  console.log(`\n📁 importRedfinDataFromFile called`)
  console.log(`   CSV length: ${csvContent.length} chars`)
  console.log(`   Metric: ${metricName || '(auto-detect)'}`)
  console.log(`   Source file: ${sourceFileName || '(not specified)'}`)
  return importRedfinData(metricName, limitRows, csvContent, undefined, onProgress, sourceFileName)
}

// Helper function to parse date values
function parseDateValue(dateValue: string): string | null {
  if (typeof dateValue !== 'string') return null

  // Quarter format (e.g., "2025 Q2")
  const quarterMatch = dateValue.match(/(\d{4})\s*Q(\d)/i)
  if (quarterMatch) {
    const year = quarterMatch[1]
    const quarter = parseInt(quarterMatch[2])
    const quarterMonths: Record<number, string> = { 1: '01', 2: '04', 3: '07', 4: '10' }
    const month = quarterMonths[quarter]
    if (month) return `${year}-${month}-01`
  }

  // Numeric M/D/Y format (e.g., "1/1/2012")
  const mdYMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdYMatch) {
    return `${mdYMatch[3]}-${mdYMatch[1].padStart(2, '0')}-${mdYMatch[2].padStart(2, '0')}`
  }

  // Full month name format (e.g., "January 2012")
  const fullMonthMatch = dateValue.match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (fullMonthMatch) {
    const fullMonthNames: Record<string, string> = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12'
    }
    const month = fullMonthNames[fullMonthMatch[1].toLowerCase()]
    if (month) return `${fullMonthMatch[2]}-${month}-01`
  }

  // MMM-YY format (e.g., "Jan-12")
  const mmmYyMatch = dateValue.match(/^([A-Za-z]{3})-(\d{2})$/)
  if (mmmYyMatch) {
    const monthNames: Record<string, string> = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    }
    const month = monthNames[mmmYyMatch[1].toLowerCase()]
    if (month) return `20${mmmYyMatch[2]}-${month}-01`
  }

  // YYYY-MM format
  const dateMatch = dateValue.match(/(\d{4})[-\/](\d{1,2})/)
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-01`
  }

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue
  }

  return null
}

// Helper function to parse metric values
function parseMetricValue(rawValue: string | number, metricCol: string): number | null {
  const lowerCol = metricCol.toLowerCase()
  const isPercentage = lowerCol.includes('mom') || lowerCol.includes('yoy') ||
    lowerCol.includes('month-over-month') || lowerCol.includes('year-over-year') ||
    lowerCol.includes('sale to list') || rawValue.toString().includes('%')

  let value: number | null = null

  if (typeof rawValue === 'string') {
    let cleaned = rawValue.replace(/[$,\s%]/g, '').toUpperCase()
    const isK = cleaned.includes('K')
    const isM = cleaned.includes('M')
    cleaned = cleaned.replace(/[KM]/g, '')
    value = parseFloat(cleaned)
    if (!isNaN(value)) {
      if (isK) value = value * 1000
      if (isM) value = value * 1000000
    }
  } else {
    value = parseFloat(String(rawValue))
  }

  // For percentages, allow negative values and zero
  // For other metrics, require positive values
  const isValidValue = value !== null && !isNaN(value) && (isPercentage ? true : value > 0)

  return isValidValue ? value : null
}
