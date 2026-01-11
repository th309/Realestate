/**
 * Import Redfin TSV files from downloaded S3 data
 * Parses cross-tab format files and imports all metrics into redfin_metrics table
 * Uses wide format: one row per geoid/date with all metrics as columns
 *
 * Refactored to use modular components from ./redfin-import/
 */

import * as fs from 'fs'
import * as path from 'path'
import { createReadStream } from 'fs'
import { parse } from 'csv-parse'
import type { SupabaseClient } from '@supabase/supabase-js'

// Import from modular components
import type { ParsedRow, MetricColumn, ImportOptions, RedfinMetricsRecord } from './redfin-import/types'
import { createSupabaseAdminClient, testConnection, insertRecordsBatch } from './redfin-import/db-client'
import { identifyMetricColumns, parseDataRow } from './redfin-import/parser'
import { getOrCreateGeoid } from './redfin-import/geoid-lookup'
import { convertToRedfinMetricsFormat, assignGeoids, filterValidRecords, groupByTable } from './redfin-import/data-transformer'

/**
 * Process a chunk of parsed rows and insert into database
 */
async function processChunk(
  chunk: ParsedRow[],
  supabase: SupabaseClient,
  regionMap: Map<string, string>,
  stats: { totalProcessed: number; totalInserted: number; totalErrors: number }
): Promise<void> {
  if (chunk.length === 0) return

  console.log(`\n  🔄 Processing chunk of ${chunk.length} rows...`)

  try {
    // Get geoids for unique regions in this chunk
    const uniqueRegions = new Set(chunk.map(r => `${r.regionType}|${r.stateCode || ''}|${r.region}`))
    console.log(`  📍 Looking up ${uniqueRegions.size} unique regions...`)

    let geoidLookups = 0
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
            const sanitized = regionName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 30)
            const fallbackGeoid = `REDFIN-${regionType.toUpperCase()}-${sanitized}`
            regionMap.set(regionKey, fallbackGeoid)
            geoidLookups++
            geoidErrors++
          }
        }
      }
    }
    console.log(`  📍 Geoid lookup: ${geoidLookups} lookups${geoidErrors > 0 ? `, ${geoidErrors} errors (using fallback)` : ''}`)

    // Convert to redfin_metrics format
    const records = convertToRedfinMetricsFormat(chunk)
    console.log(`  📊 Converted ${records.length} records to redfin_metrics format`)

    // Assign geoids
    const recordsWithGeoids = assignGeoids(records, regionMap)

    // Filter valid records
    const validRecords = filterValidRecords(recordsWithGeoids)
    console.log(`  ✅ Filtered to ${validRecords.length} valid records (from ${recordsWithGeoids.length} total)`)

    if (validRecords.length === 0) {
      console.warn(`  ⚠️  Chunk had ${recordsWithGeoids.length} records but none had valid metrics`)
      return
    }

    // Group by table and insert
    const recordsByTable = groupByTable(validRecords)
    console.log(`  💾 Grouped into ${recordsByTable.size} table(s)`)

    // Insert into each table
    for (const [tableName, tableRecords] of recordsByTable.entries()) {
      if (tableRecords.length === 0) continue

      console.log(`  💾 Inserting ${tableRecords.length} records into ${tableName}...`)

      const batchSize = 1000
      const totalBatches = Math.ceil(tableRecords.length / batchSize)

      for (let i = 0; i < tableRecords.length; i += batchSize) {
        const batch = tableRecords.slice(i, i + batchSize)
        const batchNum = Math.floor(i / batchSize) + 1

        const result = await insertRecordsBatch(supabase, tableName, batch, batchNum, totalBatches)
        stats.totalInserted += result.inserted
        stats.totalErrors += result.errors
      }
    }

    stats.totalProcessed += chunk.length
    process.stdout.write(`\r  Processed ${stats.totalProcessed.toLocaleString()} rows, inserted ${stats.totalInserted.toLocaleString()} records${stats.totalErrors > 0 ? `, ${stats.totalErrors} errors` : ''}...`)
  } catch (error: any) {
    console.error(`  ❌ Error processing chunk: ${error.message}`)
    stats.totalErrors++
  }
}

/**
 * Process TSV file in chunks and import directly (streaming to avoid memory issues)
 */
async function importTSVFileStreaming(
  filePath: string,
  supabase: SupabaseClient,
  options?: ImportOptions
): Promise<void> {
  const chunkSize = options?.chunkSize || 1000

  let headers: string[] = []
  let metricColumns: MetricColumn[] = []
  let rowCount = 0
  let currentChunk: ParsedRow[] = []
  const stats = { totalProcessed: 0, totalInserted: 0, totalErrors: 0 }

  const parser = parse({
    delimiter: '\t',
    quote: '"',
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true,
    columns: false,
    skip_records_with_error: true,
    relax_column_count: true
  })

  const stream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 64 * 1024 })
  const regionMap = new Map<string, string>()

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
        console.log(`  📖 Reading data rows...`)
      } else {
        // Check limit
        if (options?.limitRows && rowCount > options.limitRows) {
          break
        }

        // Parse data row
        try {
          const row = parseDataRow(recordArray, headers, metricColumns)
          if (row) {
            currentChunk.push(row)
          }

          // Process chunk when it reaches chunkSize
          if (currentChunk.length >= chunkSize) {
            await processChunk([...currentChunk], supabase, regionMap, stats)
            currentChunk = []
          }
        } catch (error: any) {
          console.warn(`  ⚠️  Error parsing row ${rowCount}: ${error.message}`)
        }
      }
      rowCount++

      // Log progress every 10000 rows
      if (rowCount > 0 && rowCount % 10000 === 0) {
        process.stdout.write(`\r  Read ${rowCount.toLocaleString()} rows, processed ${stats.totalProcessed.toLocaleString()}...`)
      }
    }

    // Process remaining chunk
    if (currentChunk.length > 0) {
      console.log(`  📦 Processing final chunk of ${currentChunk.length} rows...`)
      await processChunk(currentChunk, supabase, regionMap, stats)
    }

    console.log(`\n  ✅ Import complete!`)
    console.log(`     - Total rows read: ${rowCount.toLocaleString()}`)
    console.log(`     - Total rows processed: ${stats.totalProcessed.toLocaleString()}`)
    console.log(`     - Total records inserted: ${stats.totalInserted.toLocaleString()}`)
    if (stats.totalErrors > 0) {
      console.log(`     - Errors encountered: ${stats.totalErrors}`)
    }
  } catch (error: any) {
    console.error(`  ❌ Error during import: ${error.message}`)
    throw error
  }
}

/**
 * Import a single TSV file into redfin_metrics table
 */
async function importTSVFile(filePath: string, options?: ImportOptions): Promise<void> {
  const fileName = path.basename(filePath)
  console.log(`\n📊 Importing: ${fileName}`)
  console.log('='.repeat(60))

  let supabase: SupabaseClient
  try {
    supabase = createSupabaseAdminClient()
  } catch (error: any) {
    console.error(`  ❌ Failed to create Supabase client: ${error.message}`)
    throw error
  }

  const connectionOk = await testConnection(supabase)
  if (!connectionOk) {
    throw new Error('Database connection test failed.')
  }

  console.log('  📖 Parsing and importing TSV file (streaming)...')
  await importTSVFileStreaming(filePath, supabase, options)
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  const filesDir = path.join(process.cwd(), 'redfin_downloads', 'raw_files')

  let filesToImport: string[] = []
  let limitRows: number | undefined = undefined

  // Check for --limit flag
  const limitIndex = args.indexOf('--limit')
  if (limitIndex >= 0 && args[limitIndex + 1]) {
    limitRows = parseInt(args[limitIndex + 1])
    args.splice(limitIndex, 2)
  }

  if (args.length > 0) {
    filesToImport = args.map(f => path.isAbsolute(f) ? f : path.join(filesDir, f))
  } else {
    const allFiles = fs.readdirSync(filesDir)
    filesToImport = allFiles
      .filter(f => f.startsWith('housing_market_') && f.endsWith('.tsv'))
      .filter(f => ['county', 'city', 'zip'].some(level => f.includes(level)))
      .map(f => path.join(filesDir, f))
  }

  if (filesToImport.length === 0) {
    console.error('❌ No files found to import')
    console.error('   Expected files in: redfin_downloads/raw_files/')
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
    }

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
