/**
 * Import Redfin TSV files from downloaded S3 data
 * Parses cross-tab format files and imports all metrics into redfin_metrics table
 * Uses wide format: one row per geoid/date with all metrics as columns
 */

import * as fs from 'fs'
import * as path from 'path'
import { createReadStream } from 'fs'
import { parse } from 'csv-parse'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import type { SupabaseClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

/**
 * Create Supabase admin client directly (for scripts)
 * Includes proper fetch configuration for Node.js
 */
function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials. Check your .env.local file.')
  }

  // Validate URL format
  try {
    new URL(supabaseUrl)
  } catch (urlError) {
    throw new Error(`Invalid Supabase URL format: ${supabaseUrl}`)
  }

  // Use global fetch (Node.js 18+ has native fetch)
  // If not available, we'll get a clear error
  const fetchImpl = typeof fetch !== 'undefined' ? fetch : undefined

  if (!fetchImpl) {
    throw new Error('fetch is not available. Node.js 18+ is required, or install node-fetch.')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: fetchImpl
    },
    db: {
      schema: 'public'
    }
  })
}

/**
 * Test database connection before starting import
 */
async function testConnection(supabase: SupabaseClient): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    console.log('  🔌 Testing database connection...')
    console.log(`     URL: ${supabaseUrl?.substring(0, 50)}...`)
    
    // Try a simple fetch first to test network connectivity
    try {
      const testUrl = `${supabaseUrl}/rest/v1/`
      console.log(`     Testing network connectivity to Supabase...`)
      const response = await fetch(testUrl, {
        method: 'HEAD',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      console.log(`     Network test: ${response.status} ${response.statusText}`)
    } catch (fetchError: any) {
      console.error(`  ❌ Network connectivity test failed: ${fetchError.message}`)
      if (fetchError.cause) {
        console.error(`     Cause: ${fetchError.cause}`)
      }
      if (fetchError.code) {
        console.error(`     Error code: ${fetchError.code}`)
      }
      console.error(`     This suggests a network, firewall, or DNS issue.`)
      console.error(`     Please check:`)
      console.error(`     1. Your internet connection`)
      console.error(`     2. Firewall settings`)
      console.error(`     3. Supabase project status (not paused)`)
      console.error(`     4. Supabase URL is correct: ${supabaseUrl}`)
      return false
    }
    
    // Now try the actual Supabase query
    const { data, error } = await supabase
      .from('markets')
      .select('region_id')
      .limit(1)
    
    if (error) {
      console.error(`  ❌ Supabase query test failed: ${error.message}`)
      console.error(`     Code: ${error.code || 'N/A'}`)
      console.error(`     Details: ${error.details || 'N/A'}`)
      console.error(`     Hint: ${error.hint || 'N/A'}`)
      return false
    }
    
    console.log('  ✅ Database connection successful!')
    return true
  } catch (error: any) {
    console.error(`  ❌ Connection test exception: ${error.message}`)
    if (error.cause) {
      console.error(`     Cause: ${error.cause}`)
    }
    if (error.code) {
      console.error(`     Error code: ${error.code}`)
    }
    if (error.stack) {
      console.error(`     Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`)
    }
    return false
  }
}

interface MetricColumn {
  name: string
  index: number
  isMoM: boolean
  isYoY: boolean
  baseMetric: string
}

interface ParsedRow {
  periodBegin: string
  periodEnd: string
  region: string
  regionType: string
  city?: string
  state?: string
  stateCode?: string
  propertyType?: string
  metrics: Record<string, {
    value: number | null
    mom?: number | null
    yoy?: number | null
  }>
}

/**
 * Identify metric columns from the header row
 */
function identifyMetricColumns(headers: string[]): MetricColumn[] {
  const metricColumns: MetricColumn[] = []
  const metricMap = new Map<string, { base: string; index: number; type: 'value' | 'mom' | 'yoy' }>()
  
  headers.forEach((header, index) => {
    const cleanHeader = header.trim().replace(/^"|"$/g, '')
    
    // Skip non-metric columns
    const skipColumns = [
      'PERIOD_BEGIN', 'PERIOD_END', 'PERIOD_DURATION',
      'REGION_TYPE', 'REGION_TYPE_ID', 'TABLE_ID', 'IS_SEASONALLY_ADJUSTED',
      'REGION', 'CITY', 'STATE', 'STATE_CODE',
      'PROPERTY_TYPE', 'PROPERTY_TYPE_ID',
      'PARENT_METRO_REGION', 'PARENT_METRO_REGION_METRO_CODE', 'LAST_UPDATED'
    ]
    
    if (skipColumns.includes(cleanHeader)) {
      return
    }
    
    // Check if it's a metric column
    let baseMetric = cleanHeader
    let type: 'value' | 'mom' | 'yoy' = 'value'
    
    if (cleanHeader.endsWith('_MOM')) {
      baseMetric = cleanHeader.replace(/_MOM$/, '')
      type = 'mom'
    } else if (cleanHeader.endsWith('_YOY')) {
      baseMetric = cleanHeader.replace(/_YOY$/, '')
      type = 'yoy'
    }
    
    // Normalize metric name
    const normalizedMetric = baseMetric
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    
    if (!metricMap.has(normalizedMetric)) {
      metricMap.set(normalizedMetric, { base: baseMetric, index: -1, type: 'value' })
    }
    
    const metric = metricMap.get(normalizedMetric)!
    if (type === 'value') {
      metric.index = index
    } else if (type === 'mom') {
      metricMap.set(`${normalizedMetric}_mom`, { base: baseMetric, index, type: 'mom' })
    } else if (type === 'yoy') {
      metricMap.set(`${normalizedMetric}_yoy`, { base: baseMetric, index, type: 'yoy' })
    }
  })
  
  // Build metric columns array
  metricMap.forEach((info, normalizedMetric) => {
    if (info.type === 'value' && info.index >= 0) {
      metricColumns.push({
        name: normalizedMetric,
        index: info.index,
        isMoM: false,
        isYoY: false,
        baseMetric: info.base
      })
      
      // Add MoM and YoY if they exist
      const momKey = `${normalizedMetric}_mom`
      const yoyKey = `${normalizedMetric}_yoy`
      
      if (metricMap.has(momKey)) {
        metricColumns.push({
          name: normalizedMetric,
          index: metricMap.get(momKey)!.index,
          isMoM: true,
          isYoY: false,
          baseMetric: info.base
        })
      }
      
      if (metricMap.has(yoyKey)) {
        metricColumns.push({
          name: normalizedMetric,
          index: metricMap.get(yoyKey)!.index,
          isMoM: false,
          isYoY: true,
          baseMetric: info.base
        })
      }
    }
  })
  
  return metricColumns
}

/**
 * Process TSV file in chunks and import directly (streaming to avoid memory issues)
 */
async function importTSVFileStreaming(
  filePath: string,
  supabase: SupabaseClient,
  options?: { limitRows?: number; chunkSize?: number }
): Promise<void> {
  const chunkSize = options?.chunkSize || 1000
  const fileName = path.basename(filePath)
  
  let headers: string[] = []
  let metricColumns: MetricColumn[] = []
  let rowCount = 0
  let currentChunk: ParsedRow[] = []
  let totalProcessed = 0
  let totalInserted = 0
  let totalErrors = 0
  
  const parser = parse({
    delimiter: '\t',
    quote: '"',
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true,
    columns: false, // We'll handle headers manually
    skip_records_with_error: true,
    relax_column_count: true
  })
  
  const stream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 64 * 1024 })
  const regionMap = new Map<string, string>()
  
  // Queue for processing chunks sequentially
  const chunkQueue: ParsedRow[][] = []
  let processingQueue = false
    
    // Process chunk and insert into database
    const processChunk = async (chunk: ParsedRow[]): Promise<void> => {
      if (chunk.length === 0) {
        console.log(`  ⚠️  processChunk called with empty chunk`)
        return
      }
      
      console.log(`\n  🔄 Processing chunk of ${chunk.length} rows...`)
      console.log(`  🔍 Sample row from chunk:`, {
        region: chunk[0].region,
        regionType: chunk[0].regionType,
        stateCode: chunk[0].stateCode,
        metricsCount: Object.keys(chunk[0].metrics).length,
        sampleMetrics: Object.keys(chunk[0].metrics).slice(0, 3)
      })
      
      try {
        // Get geoids for unique regions in this chunk
        const uniqueRegions = new Set(chunk.map(r => `${r.regionType}|${r.stateCode || ''}|${r.region}`))
        console.log(`  📍 Looking up ${uniqueRegions.size} unique regions...`)
        console.log(`  📍 Sample region keys:`, Array.from(uniqueRegions).slice(0, 3).join(', '))
        
        let geoidLookups = 0
        let geoidCacheHits = 0
        let geoidErrors = 0
        for (const regionKey of uniqueRegions) {
          if (!regionMap.has(regionKey)) {
            const [regionType, stateCode, regionName] = regionKey.split('|')
            const row = chunk.find(r => r.region === regionName && r.regionType === regionType && (r.stateCode || '') === stateCode)
            if (row) {
              try {
                const geoid = await getOrCreateGeoid(supabase, regionName, regionType, stateCode || undefined, row.city)
                regionMap.set(regionKey, geoid)
                geoidLookups++
              } catch (error: any) {
                // Use fallback geoid on error
                const sanitized = regionName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 30)
                const fallbackGeoid = `REDFIN-${regionType.toUpperCase()}-${sanitized}`
                regionMap.set(regionKey, fallbackGeoid)
                geoidLookups++
                geoidErrors++
                if (geoidErrors <= 3) {
                  console.warn(`  ⚠️  Geoid lookup error for ${regionName}, using fallback: ${error.message}`)
                }
              }
            }
          } else {
            geoidCacheHits++
          }
        }
        if (geoidErrors > 0) {
          console.log(`  📍 Geoid lookup: ${geoidLookups} lookups, ${geoidCacheHits} cached, ${geoidErrors} errors (using fallback)`)
        } else {
          console.log(`  📍 Geoid lookup: ${geoidLookups} lookups, ${geoidCacheHits} cached`)
        }
        
        // Convert to redfin_metrics format
        console.log(`  📊 Converting ${chunk.length} rows to redfin_metrics format...`)
        const records = convertToRedfinMetricsFormat(chunk)
        console.log(`  📊 Converted ${records.length} records to redfin_metrics format`)
        
        if (records.length > 0) {
          console.log(`  🔍 Sample converted record (before geoid):`, {
            metric_date: records[0].metric_date,
            _regionName: records[0]._regionName,
            _regionType: records[0]._regionType,
            _stateCode: records[0]._stateCode,
            keys: Object.keys(records[0]).filter(k => !k.startsWith('_')).slice(0, 5)
          })
        }
        
        // Assign geoids
        console.log(`  🔍 Assigning geoids to ${records.length} records...`)
        const recordsWithGeoids = records.map((record, idx) => {
          const regionKey = `${record._regionType}|${record._stateCode || ''}|${record._regionName}`
          const geoid = regionMap.get(regionKey) || record._regionName
          if (idx === 0) {
            console.log(`  🔍 First record geoid assignment: regionKey="${regionKey}", geoid="${geoid}"`)
          }
          delete record._regionName
          delete record._regionType
          delete record._stateCode
          delete record._city
          return { ...record, geoid }
        })
        console.log(`  ✅ Assigned geoids to ${recordsWithGeoids.length} records`)
        
        // Filter out records with no metric values
        console.log(`  🔍 Filtering ${recordsWithGeoids.length} records for valid metrics...`)
        if (recordsWithGeoids.length > 0) {
          const sampleRecord = recordsWithGeoids[0]
          console.log(`  🔍 Sample record before filtering:`, {
            geoid: sampleRecord.geoid,
            metric_date: sampleRecord.metric_date,
            allKeys: Object.keys(sampleRecord),
            metricKeys: Object.keys(sampleRecord).filter(k => k !== 'geoid' && k !== 'metric_date'),
            sampleValues: Object.entries(sampleRecord)
              .filter(([k]) => k !== 'geoid' && k !== 'metric_date')
              .slice(0, 5)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ')
          })
        }
        
        const validRecords = recordsWithGeoids.filter((record, idx) => {
          const hasMetrics = Object.keys(record).some(key => 
            key !== 'geoid' && 
            key !== 'metric_date' && 
            record[key] != null && 
            record[key] !== undefined &&
            record[key] !== ''
          )
          const isValid = hasMetrics && record.geoid && record.metric_date
          
          if (idx === 0) {
            console.log(`  🔍 First record validation:`, {
              hasMetrics,
              hasGeoid: !!record.geoid,
              hasMetricDate: !!record.metric_date,
              isValid,
              metricCount: Object.keys(record).filter(k => k !== 'geoid' && k !== 'metric_date' && record[k] != null).length
            })
          }
          
          return isValid
        })
        
        console.log(`  ✅ Filtered to ${validRecords.length} valid records (from ${recordsWithGeoids.length} total)`)
        
        if (validRecords.length === 0) {
          console.warn(`  ⚠️  Chunk had ${recordsWithGeoids.length} records but none had valid metrics`)
          if (recordsWithGeoids.length > 0) {
            const sample = recordsWithGeoids[0]
            console.warn(`  ⚠️  Sample record keys:`, Object.keys(sample).join(', '))
            console.warn(`  ⚠️  Sample record values:`, JSON.stringify(sample, null, 2))
            console.warn(`  ⚠️  Sample record has geoid:`, !!sample.geoid)
            console.warn(`  ⚠️  Sample record has metric_date:`, !!sample.metric_date)
            console.warn(`  ⚠️  Sample record non-null values:`, Object.entries(sample).filter(([k, v]) => v != null && k !== 'geoid' && k !== 'metric_date').map(([k, v]) => `${k}=${v}`).join(', '))
          }
          return
        }
        
        console.log(`  🔍 Sample valid record:`, {
          geoid: validRecords[0].geoid,
          metric_date: validRecords[0].metric_date,
          metricKeys: Object.keys(validRecords[0]).filter(k => k !== 'geoid' && k !== 'metric_date' && validRecords[0][k] != null)
        })
        
        // Group by table and insert
        console.log(`  💾 Grouping ${validRecords.length} records by year table...`)
        const recordsByTable = new Map<string, any[]>()
        let dateErrors = 0
        validRecords.forEach((record, idx) => {
          try {
            const date = new Date(record.metric_date)
            if (isNaN(date.getTime())) {
              if (dateErrors === 0) {
                console.warn(`  ⚠️  Invalid date: ${record.metric_date} (first occurrence)`)
              }
              dateErrors++
              return
            }
            const year = date.getFullYear()
            const tableName = year === 2024 ? 'redfin_metrics_2024' : year === 2025 ? 'redfin_metrics_2025' : 'redfin_metrics'
            if (!recordsByTable.has(tableName)) {
              recordsByTable.set(tableName, [])
            }
            recordsByTable.get(tableName)!.push(record)
            
            if (idx === 0) {
              console.log(`  🔍 First record grouped: date="${record.metric_date}", year=${year}, table="${tableName}"`)
            }
          } catch (error: any) {
            console.warn(`  ⚠️  Error processing record date: ${error.message}`)
            dateErrors++
          }
        })
        
        if (dateErrors > 0) {
          console.warn(`  ⚠️  ${dateErrors} records had invalid dates`)
        }
        
        console.log(`  💾 Grouped into ${recordsByTable.size} table(s):`, Array.from(recordsByTable.keys()).join(', '))
        recordsByTable.forEach((records, tableName) => {
          console.log(`     ${tableName}: ${records.length} records`)
        })
        
        // Insert into each table
        console.log(`  💾 Inserting into ${recordsByTable.size} table(s)...`)
        for (const [tableName, tableRecords] of recordsByTable.entries()) {
          if (tableRecords.length === 0) {
            console.log(`  ⚠️  Skipping ${tableName} - no records`)
            continue
          }
          
          console.log(`  💾 Inserting ${tableRecords.length} records into ${tableName}...`)
          console.log(`  🔍 Sample record for ${tableName}:`, {
            geoid: tableRecords[0].geoid,
            metric_date: tableRecords[0].metric_date,
            keys: Object.keys(tableRecords[0]).slice(0, 10)
          })
          
          const batchSize = 1000
          const numBatches = Math.ceil(tableRecords.length / batchSize)
          console.log(`  💾 Will insert in ${numBatches} batch(es) of up to ${batchSize} records each`)
          
          for (let i = 0; i < tableRecords.length; i += batchSize) {
            const batch = tableRecords.slice(i, i + batchSize)
            const batchNum = Math.floor(i / batchSize) + 1
            console.log(`  💾 Inserting batch ${batchNum}/${numBatches} into ${tableName} (${batch.length} records)...`)
            
            let retries = 3
            let inserted = false
            while (retries > 0 && !inserted) {
              try {
                const { error, data } = await supabase
                  .from(tableName)
                  .upsert(batch, {
                    onConflict: 'geoid,metric_date',
                    ignoreDuplicates: false
                  })
                
                if (error) {
                  // Check if it's a connection error - retry these
                  const isConnectionError = error.message?.includes('fetch') || 
                                          error.message?.includes('network') || 
                                          error.message?.includes('ECONNREFUSED') ||
                                          error.message?.includes('ETIMEDOUT')
                  
                  if (isConnectionError && retries > 1) {
                    retries--
                    const delay = Math.pow(2, 3 - retries) * 1000 // Exponential backoff: 1s, 2s, 4s
                    console.warn(`  ⚠️  Connection error, retrying in ${delay}ms... (${retries} retries left)`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                    continue
                  }
                  
                  // Non-connection errors or final retry failed
                  console.error(`  ❌ Error inserting batch ${batchNum} into ${tableName}: ${error.message}`)
                  if (batchNum === 1) {
                    console.error(`     Error code: ${error.code || 'N/A'}`)
                    console.error(`     Error details: ${error.details || 'N/A'}`)
                    console.error(`     Error hint: ${error.hint || 'N/A'}`)
                    console.error(`     First record keys:`, Object.keys(batch[0]).join(', '))
                  }
                  totalErrors++
                  inserted = true // Stop retrying
                } else {
                  totalInserted += batch.length
                  if (batchNum === 1 || batchNum % 10 === 0 || batchNum === numBatches) {
                    console.log(`  ✅ Inserted batch ${batchNum}/${numBatches} into ${tableName} (${batch.length} records)`)
                  }
                  inserted = true
                }
              } catch (error: any) {
                const isConnectionError = error.message?.includes('fetch') || 
                                        error.message?.includes('network') ||
                                        error.message?.includes('ECONNREFUSED')
                
                if (isConnectionError && retries > 1) {
                  retries--
                  const delay = Math.pow(2, 3 - retries) * 1000
                  console.warn(`  ⚠️  Exception, retrying in ${delay}ms... (${retries} retries left): ${error.message}`)
                  await new Promise(resolve => setTimeout(resolve, delay))
                  continue
                }
                
                console.error(`  ❌ Exception inserting batch ${batchNum} into ${tableName}: ${error.message}`)
                if (batchNum === 1) {
                  console.error(`     Exception type: ${error.constructor.name}`)
                }
                totalErrors++
                inserted = true // Stop retrying
              }
            }
          }
          
          console.log(`  ✅ Completed inserts for ${tableName}`)
        }
        
        totalProcessed += chunk.length
        process.stdout.write(`\r  Processed ${totalProcessed.toLocaleString()} rows, inserted ${totalInserted.toLocaleString()} records${totalErrors > 0 ? `, ${totalErrors} errors` : ''}...`)
      } catch (error: any) {
        console.error(`  ❌ Error processing chunk: ${error.message}`)
        console.error(error.stack)
        totalErrors++
        // Don't throw - continue processing
      }
    }
    
    // Process queue sequentially
    const processQueue = async (): Promise<void> => {
      if (processingQueue || chunkQueue.length === 0) return
      processingQueue = true
      
      while (chunkQueue.length > 0) {
        const chunk = chunkQueue.shift()!
        await processChunk(chunk)
      }
      
      processingQueue = false
    }
    
  // Use async iteration which is more reliable for streaming
  stream.pipe(parser)
  
  console.log(`  🔄 Starting to parse file...`)
  
  try {
    for await (const record of parser) {
      const recordArray = record as string[]
      
      if (rowCount === 0) {
        // Header row
        headers = recordArray
        console.log(`  📋 Header row parsed: ${headers.length} columns`)
        console.log(`  📋 First 10 headers: ${headers.slice(0, 10).join(', ')}`)
        metricColumns = identifyMetricColumns(headers)
        console.log(`  📋 Found ${metricColumns.filter(m => !m.isMoM && !m.isYoY).length} base metrics`)
        console.log(`  📋 Total metric columns (including MoM/YoY): ${metricColumns.length}`)
        console.log(`  📋 Sample metric columns:`, metricColumns.slice(0, 5).map(m => `${m.name}${m.isMoM ? '_MOM' : ''}${m.isYoY ? '_YOY' : ''}`).join(', '))
        console.log(`  📖 Reading data rows...`)
      } else {
        // Log first few rows immediately
        if (rowCount <= 3) {
          console.log(`  ✅ Read row ${rowCount}: ${recordArray[headers.indexOf('REGION')] || 'N/A'}`)
        }
        // Check limit
        if (options?.limitRows && rowCount > options.limitRows) {
          break
        }
        
        // Data row
        try {
          const periodBeginIdx = headers.indexOf('PERIOD_BEGIN')
          const periodEndIdx = headers.indexOf('PERIOD_END')
          const regionIdx = headers.indexOf('REGION')
          const regionTypeIdx = headers.indexOf('REGION_TYPE')
          
          const row: ParsedRow = {
            periodBegin: recordArray[periodBeginIdx]?.replace(/^"|"$/g, '') || '',
            periodEnd: recordArray[periodEndIdx]?.replace(/^"|"$/g, '') || '',
            region: recordArray[regionIdx]?.replace(/^"|"$/g, '').trim() || '',
            regionType: recordArray[regionTypeIdx]?.replace(/^"|"$/g, '').toLowerCase() || '',
            city: recordArray[headers.indexOf('CITY')]?.replace(/^"|"$/g, '') || undefined,
            state: recordArray[headers.indexOf('STATE')]?.replace(/^"|"$/g, '') || undefined,
            stateCode: recordArray[headers.indexOf('STATE_CODE')]?.replace(/^"|"$/g, '') || undefined,
            propertyType: recordArray[headers.indexOf('PROPERTY_TYPE')]?.replace(/^"|"$/g, '') || undefined,
            metrics: {}
          }
          
          // Log first row details
          if (rowCount === 1) {
            console.log(`  🔍 First data row details:`)
            console.log(`     Region: "${row.region}"`)
            console.log(`     Region Type: "${row.regionType}"`)
            console.log(`     State Code: "${row.stateCode}"`)
            console.log(`     Period Begin: "${row.periodBegin}"`)
            console.log(`     Period End: "${row.periodEnd}"`)
            console.log(`     Record array length: ${recordArray.length}`)
          }
          
          // Extract all metrics
          let metricsExtracted = 0
          metricColumns.forEach(col => {
            if (!col.isMoM && !col.isYoY) {
              const valueStr = recordArray[col.index]?.replace(/^"|"$/g, '') || ''
              const value = valueStr && valueStr !== 'NA' && valueStr !== '' ? parseFloat(valueStr) : null
              if (value !== null && !isNaN(value)) {
                if (!row.metrics[col.name]) {
                  row.metrics[col.name] = { value: null }
                }
                row.metrics[col.name].value = value
                metricsExtracted++
              }
            } else if (col.isMoM) {
              const momStr = recordArray[col.index]?.replace(/^"|"$/g, '') || ''
              const mom = momStr && momStr !== 'NA' && momStr !== '' ? parseFloat(momStr) : null
              if (mom !== null && !isNaN(mom) && row.metrics[col.name]) {
                row.metrics[col.name].mom = mom
              }
            } else if (col.isYoY) {
              const yoyStr = recordArray[col.index]?.replace(/^"|"$/g, '') || ''
              const yoy = yoyStr && yoyStr !== 'NA' && yoyStr !== '' ? parseFloat(yoyStr) : null
              if (yoy !== null && !isNaN(yoy) && row.metrics[col.name]) {
                row.metrics[col.name].yoy = yoy
              }
            }
          })
          
          if (rowCount === 1) {
            console.log(`     Metrics extracted: ${metricsExtracted}`)
            console.log(`     Metric names: ${Object.keys(row.metrics).join(', ')}`)
            console.log(`     Sample metrics:`, Object.entries(row.metrics).slice(0, 3).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', '))
          }
          
          currentChunk.push(row)
          
          // Process chunk when it reaches chunkSize
          if (currentChunk.length >= chunkSize) {
            console.log(`  📦 Chunk reached size ${chunkSize}, processing...`)
            await processChunk([...currentChunk])
            currentChunk = []
            console.log(`  ✅ Chunk processed, continuing to read...`)
          }
        } catch (error: any) {
          console.warn(`  ⚠️  Error parsing row ${rowCount}: ${error.message}`)
        }
      }
      rowCount++
      
      // Log progress every 10000 rows read
      if (rowCount > 0 && rowCount % 10000 === 0) {
        process.stdout.write(`\r  Read ${rowCount.toLocaleString()} rows, processed ${totalProcessed.toLocaleString()}...`)
      }
    }
    
    // Process remaining chunk
    if (currentChunk.length > 0) {
      console.log(`  📦 Processing final chunk of ${currentChunk.length} rows...`)
      await processChunk(currentChunk)
    } else {
      console.log(`  ℹ️  No remaining chunk to process`)
    }
    
    console.log(`\n  ✅ Import complete!`)
    console.log(`     - Total rows read: ${rowCount.toLocaleString()}`)
    console.log(`     - Total rows processed: ${totalProcessed.toLocaleString()}`)
    console.log(`     - Total records inserted: ${totalInserted.toLocaleString()}`)
    if (totalErrors > 0) {
      console.log(`     - Errors encountered: ${totalErrors}`)
    }
    if (totalInserted === 0 && totalProcessed > 0) {
      console.error(`\n  ❌ CRITICAL: Processed ${totalProcessed} rows but inserted 0 records!`)
      console.error(`     This indicates a problem with data conversion or database insertion.`)
      console.error(`     Check the logs above for filtering or insertion errors.`)
    }
  } catch (error: any) {
    console.error(`  ❌ Error during import: ${error.message}`)
    console.error(error.stack)
    throw error
  }
}

/**
 * Map Redfin region to geoid (GEOID from markets table or generate one)
 */
async function getOrCreateGeoid(
  supabase: SupabaseClient,
  regionName: string,
  regionType: string,
  stateCode?: string,
  city?: string,
  retries: number = 2
): Promise<string> {
  // Normalize region type
  const normalizedType = regionType.toLowerCase()
  
  // Try normalization tables first (these have the authoritative geoids)
  if (normalizedType === 'county') {
    // Clean county name (remove "County" suffix and state suffix)
    let cleanName = regionName.replace(/,?\s*[A-Z]{2}$/, '') // Remove ", IL" suffix
    cleanName = cleanName.replace(/\s+County$/i, '').trim() // Remove "County" suffix
    
    // Get state FIPS if state code provided
    if (stateCode) {
      const { data: stateData, error: stateError } = await supabase
        .from('tiger_states')
        .select('geoid, name, state_abbreviation')
        .eq('state_abbreviation', stateCode.toUpperCase())
        .maybeSingle()
      
      if (stateError) {
        // State lookup failed - will use fallback
        return `REDFIN-${normalizedType.toUpperCase()}-${regionName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 30)}`
      }
      
      if (!stateData?.geoid) {
        // State not found - will use fallback
        return `REDFIN-${normalizedType.toUpperCase()}-${regionName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 30)}`
      }
      
      // Query tiger_counties - try exact match first, then partial
      let countyQuery = supabase
        .from('tiger_counties')
        .select('geoid, name, state_fips')
        .eq('state_fips', stateData.geoid)
      
      // Try exact match first (case-insensitive) with retry
      let exactCounty, exactError
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const result = await countyQuery
            .ilike('name', cleanName)
            .limit(1)
            .maybeSingle()
          exactCounty = result.data
          exactError = result.error
          if (!exactError || !exactError.message?.includes('fetch')) break
          if (attempt < retries - 1) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        } catch (e: any) {
          exactError = e
          if (attempt < retries - 1 && e.message?.includes('fetch')) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
            continue
          }
          break
        }
      }
      
      if (exactCounty?.geoid) {
        return exactCounty.geoid
      }
      
      // Try partial match with retry
      let partialCounty, partialError
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const result = await countyQuery
            .ilike('name', `%${cleanName}%`)
            .limit(1)
            .maybeSingle()
          partialCounty = result.data
          partialError = result.error
          if (!partialError || !partialError.message?.includes('fetch')) break
          if (attempt < retries - 1) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        } catch (e: any) {
          partialError = e
          if (attempt < retries - 1 && e.message?.includes('fetch')) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
            continue
          }
          break
        }
      }
      
      if (partialCounty?.geoid) {
        return partialCounty.geoid
      }
      
      // No match found in tiger_counties - check if table has data for this state
      // This helps debug why lookups are failing
      const { data: sampleCounties } = await supabase
        .from('tiger_counties')
        .select('geoid, name')
        .eq('state_fips', stateData.geoid)
        .limit(5)
      
      // No match found in tiger_counties - use fallback
      return `REDFIN-${normalizedType.toUpperCase()}-${regionName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 30)}`
    }
  } else if (normalizedType === 'state') {
    // Query tiger_states by abbreviation or name
    let stateQuery = supabase
      .from('tiger_states')
      .select('geoid, name, state_abbreviation')
    
    if (stateCode) {
      stateQuery = stateQuery.eq('state_abbreviation', stateCode.toUpperCase())
    } else {
      // Clean state name
      const cleanName = regionName.replace(/,?\s*[A-Z]{2}$/, '').trim()
      stateQuery = stateQuery.ilike('name', `%${cleanName}%`)
    }
    
    const { data: stateData, error: stateError } = await stateQuery.limit(1).maybeSingle()
    
    if (stateError) {
      console.log(`    ⚠️  State lookup error: ${stateError.message}`)
    }
    
    if (stateData?.geoid) {
      console.log(`    ✅ Found state geoid in normalization table: ${stateData.geoid} (${stateData.name})`)
      return stateData.geoid
    }
  } else if (normalizedType === 'metro' || normalizedType === 'msa') {
    // Query tiger_cbsa
    const cleanName = regionName.replace(/,?\s*[A-Z]{2}(-[A-Z]{2})?$/, '').trim()
    
    // Try exact match first
    const { data: exactCbsa, error: exactError } = await supabase
      .from('tiger_cbsa')
      .select('geoid, name')
      .ilike('name', cleanName)
      .limit(1)
      .maybeSingle()
    
    if (exactError) {
      console.log(`    ⚠️  CBSA exact match error: ${exactError.message}`)
    }
    
    if (exactCbsa?.geoid) {
      console.log(`    ✅ Found CBSA geoid in normalization table: ${exactCbsa.geoid} (${exactCbsa.name})`)
      return exactCbsa.geoid
    }
    
    // Try partial match
    const { data: partialCbsa, error: partialError } = await supabase
      .from('tiger_cbsa')
      .select('geoid, name')
      .ilike('name', `%${cleanName}%`)
      .limit(1)
      .maybeSingle()
    
    if (partialError) {
      console.log(`    ⚠️  CBSA partial match error: ${partialError.message}`)
    }
    
    if (partialCbsa?.geoid) {
      console.log(`    ✅ Found CBSA geoid in normalization table (partial match): ${partialCbsa.geoid} (${partialCbsa.name})`)
      return partialCbsa.geoid
    }
  } else if (normalizedType === 'zip' || normalizedType === 'zipcode') {
    // Extract ZIP code (5 digits)
    const zipMatch = regionName.match(/\b(\d{5})\b/)
    if (zipMatch) {
      const zipCode = zipMatch[1]
      const { data: zipData, error: zipError } = await supabase
        .from('tiger_zcta')
        .select('geoid')
        .eq('geoid', zipCode)
        .maybeSingle()
      
      if (zipError) {
        console.log(`    ⚠️  ZIP lookup error: ${zipError.message}`)
      }
      
      if (zipData?.geoid) {
        console.log(`    ✅ Found ZIP geoid in normalization table: ${zipData.geoid}`)
        return zipData.geoid
      }
    }
  }
  
  // Fallback: Try markets table (existing logic)
  let query = supabase
    .from('markets')
    .select('region_id')
    .eq('region_type', regionType)
    .ilike('region_name', `%${regionName}%`)
  
  if (stateCode) {
    query = query.eq('state_code', stateCode)
  }
  
  const { data, error: queryError } = await query.limit(1).maybeSingle()
  
  if (queryError) {
    console.log(`    ⚠️  Markets table query error (not fatal, will use fallback): ${queryError.message}`)
  }
  
  if (data?.region_id) {
    console.log(`    ✅ Found market with region_id: ${data.region_id}`)
    // Extract GEOID from region_id or use region_id as geoid
    // For Redfin, we might need to look up the GEOID from external_ids
    const { data: marketData, error: marketError } = await supabase
      .from('markets')
      .select('external_ids, geoid')
      .eq('region_id', data.region_id)
      .maybeSingle()
    
    if (marketError) {
      console.log(`    ⚠️  Market data lookup error: ${marketError.message}`)
    }
    
    if (marketData?.geoid) {
      console.log(`    ✅ Found geoid in market: ${marketData.geoid}`)
      return marketData.geoid
    }
    
    // If no geoid, use region_id as geoid (for Redfin-specific regions)
    console.log(`    ✅ Using region_id as geoid: ${data.region_id}`)
    return data.region_id
  }
  
  // Final fallback: Generate geoid
  // Format: REDFIN-{TYPE}-{sanitized-name}
  const sanitized = regionName
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toUpperCase()
    .substring(0, 30)
  
  const fallbackGeoid = `REDFIN-${regionType.toUpperCase()}-${sanitized}`
  console.log(`    ✅ No match found in normalization or markets tables, using fallback geoid: ${fallbackGeoid}`)
  return fallbackGeoid
}

/**
 * Convert parsed rows to redfin_metrics format (wide format)
 */
function convertToRedfinMetricsFormat(rows: ParsedRow[]): Array<{
  geoid: string
  metric_date: string
  median_sale_price?: number
  median_list_price?: number
  median_ppsf?: number
  homes_sold?: number
  new_listings?: number
  inventory?: number
  months_of_supply?: number
  median_days_on_market?: number
  average_sale_to_list?: number
  compete_score?: number
  bidding_war_percentage?: number
  price_drops_percentage?: number
  median_sale_price_yoy?: number
  homes_sold_yoy?: number
  data_freshness?: string
}> {
  const records: any[] = []
  
  if (rows.length > 0) {
    console.log(`    🔍 convertToRedfinMetricsFormat: processing ${rows.length} rows`)
    console.log(`    🔍 First row metrics:`, Object.keys(rows[0].metrics).slice(0, 10).join(', '))
  }
  
  rows.forEach((row, idx) => {
    const record: any = {
      metric_date: row.periodEnd || row.periodBegin
    }
    
    if (idx === 0) {
      console.log(`    🔍 First row conversion: periodEnd="${row.periodEnd}", periodBegin="${row.periodBegin}", metric_date="${record.metric_date}"`)
    }
    
    // Map metrics to redfin_metrics columns
    Object.entries(row.metrics).forEach(([metricName, metricData]) => {
      const normalizedName = metricName.toLowerCase()
      
      // Map to redfin_metrics column names
      if (normalizedName.includes('median_sale_price') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.median_sale_price = metricData.value
        if (metricData.yoy !== null && metricData.yoy !== undefined) {
          record.median_sale_price_yoy = metricData.yoy
        }
      } else if (normalizedName.includes('median_list_price') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.median_list_price = metricData.value
      } else if ((normalizedName.includes('median_ppsf') || normalizedName.includes('price_per_square_foot')) && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.median_ppsf = metricData.value
      } else if (normalizedName.includes('homes_sold') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.homes_sold = metricData.value
        if (metricData.yoy !== null && metricData.yoy !== undefined) {
          record.homes_sold_yoy = metricData.yoy
        }
      } else if (normalizedName.includes('new_listings') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.new_listings = metricData.value
      } else if (normalizedName.includes('inventory') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.inventory = metricData.value
      } else if (normalizedName.includes('months_of_supply') && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.months_of_supply = metricData.value
      } else if ((normalizedName.includes('median_dom') || normalizedName.includes('days_on_market')) && !normalizedName.includes('yoy') && !normalizedName.includes('mom')) {
        record.median_days_on_market = metricData.value
      } else if (normalizedName.includes('sale_to_list') || normalizedName.includes('sale_to_list_ratio')) {
        record.average_sale_to_list = metricData.value
      } else if (normalizedName.includes('compete_score')) {
        record.compete_score = metricData.value
      } else if (normalizedName.includes('bidding_war') || normalizedName.includes('sold_above_list')) {
        record.bidding_war_percentage = metricData.value
      } else if (normalizedName.includes('price_drops') || normalizedName.includes('price_drop')) {
        record.price_drops_percentage = metricData.value
      }
    })
    
    // Store region info for later geoid lookup
    record._regionName = row.region
    record._regionType = row.regionType
    record._stateCode = row.stateCode
    record._city = row.city
    
    if (idx === 0) {
      const metricCount = Object.keys(record).filter(k => !k.startsWith('_') && k !== 'metric_date').length
      console.log(`    🔍 First row converted: ${metricCount} metrics mapped, keys:`, Object.keys(record).filter(k => !k.startsWith('_')).slice(0, 10).join(', '))
    }
    
    records.push(record)
  })
  
  if (records.length > 0) {
    const firstRecord = records[0]
    const metricKeys = Object.keys(firstRecord).filter(k => !k.startsWith('_') && k !== 'metric_date')
    console.log(`    ✅ Conversion complete: ${records.length} records, first record has ${metricKeys.length} metrics`)
  }
  
  return records
}

/**
 * Import a single TSV file into redfin_metrics table (streaming version)
 */
async function importTSVFile(filePath: string, options?: { limitRows?: number }): Promise<void> {
  const fileName = path.basename(filePath)
  console.log(`\n📊 Importing: ${fileName}`)
  console.log('='.repeat(60))
  
  // Create client and test connection
  let supabase: SupabaseClient
  try {
    supabase = createSupabaseAdminClient()
  } catch (error: any) {
    console.error(`  ❌ Failed to create Supabase client: ${error.message}`)
    throw error
  }
  
  // Test connection before starting import
  const connectionOk = await testConnection(supabase)
  if (!connectionOk) {
    throw new Error('Database connection test failed. Please check your Supabase configuration and network connection.')
  }
  
  // Use streaming import to avoid memory issues
  console.log('  📖 Parsing and importing TSV file (streaming)...')
  await importTSVFileStreaming(filePath, supabase, options)
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  const filesDir = path.join(process.cwd(), 'redfin_downloads', 'raw_files')
  
  // Determine which files to import
  let filesToImport: string[] = []
  let limitRows: number | undefined = undefined
  
  // Check for --limit flag
  const limitIndex = args.indexOf('--limit')
  if (limitIndex >= 0 && args[limitIndex + 1]) {
    limitRows = parseInt(args[limitIndex + 1])
    args.splice(limitIndex, 2) // Remove --limit and value from args
  }
  
  if (args.length > 0) {
    // Import specific files
    filesToImport = args.map(f => {
      if (path.isAbsolute(f)) {
        return f
      }
      return path.join(filesDir, f)
    })
  } else {
    // Import all monthly TSV files (county, city, zip)
    const allFiles = fs.readdirSync(filesDir)
    filesToImport = allFiles
      .filter(f => f.startsWith('housing_market_') && f.endsWith('.tsv'))
      .filter(f => ['county', 'city', 'zip'].some(level => f.includes(level)))
      .map(f => path.join(filesDir, f))
  }
  
  if (filesToImport.length === 0) {
    console.error('❌ No files found to import')
    console.error('   Expected files in: redfin_downloads/raw_files/')
    console.error('   Files: housing_market_county.tsv, housing_market_city.tsv, housing_market_zip.tsv')
    process.exit(1)
  }
  
  console.log(`\n📦 Importing ${filesToImport.length} Redfin TSV file(s)`)
  console.log('='.repeat(60))
  
  for (const [index, filePath] of filesToImport.entries()) {
    console.log(`\n[${index + 1}/${filesToImport.length}]`)
    
    if (!fs.existsSync(filePath)) {
      console.error(`  ❌ File not found: ${filePath}`)
      continue
    }
    
    try {
      await importTSVFile(filePath, { limitRows })
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`)
      console.error(error.stack)
    }
    
    // Small delay between files
    if (index < filesToImport.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ Import complete!')
}

main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

