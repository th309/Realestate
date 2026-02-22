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
import { preloadGeoidCache, resolveGeoidFromCache } from './redfin-import/geoid-lookup'
import { convertToRedfinMetricsFormat, assignGeoids, filterValidRecords, groupByTable } from './redfin-import/data-transformer'

/**
 * Process a chunk of parsed rows and insert into database.
 * Uses in-memory geoid cache for instant lookups (no DB roundtrips).
 */
async function processChunk(
  chunk: ParsedRow[],
  supabase: SupabaseClient,
  regionMap: Map<string, string>,
  stats: { totalProcessed: number; totalInserted: number; totalErrors: number }
): Promise<void> {
  if (chunk.length === 0) return

  try {
    // Resolve geoids for unique regions using in-memory cache
    const uniqueRegions = new Set(chunk.map(r => `${r.regionType}|${r.stateCode || ''}|${r.region}`))

    let newLookups = 0
    for (const regionKey of uniqueRegions) {
      if (!regionMap.has(regionKey)) {
        const [regionType, stateCode, regionName] = regionKey.split('|')
        const geoid = resolveGeoidFromCache(regionName, regionType, stateCode || undefined)
        regionMap.set(regionKey, geoid)
        newLookups++
      }
    }

    // Convert to redfin_metrics format
    const records = convertToRedfinMetricsFormat(chunk)

    // Assign geoids
    const recordsWithGeoids = assignGeoids(records, regionMap)

    // Filter valid records
    const validRecords = filterValidRecords(recordsWithGeoids)

    if (validRecords.length === 0) return

    // Group by table and insert
    const recordsByTable = groupByTable(validRecords)

    // Insert into each table
    for (const [tableName, tableRecords] of recordsByTable.entries()) {
      if (tableRecords.length === 0) continue

      // Use smaller batch size for the main redfin_metrics table (10M+ rows causes statement timeouts)
      const batchSize = tableName === 'redfin_metrics' ? 300 : 1000
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

  const stream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 256 * 1024 })
  const regionMap = new Map<string, string>()

  // Pre-load all geoid reference tables into memory before streaming
  await preloadGeoidCache(supabase)

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

      // Log progress every 50000 rows
      if (rowCount > 0 && rowCount % 50000 === 0) {
        process.stdout.write(`\r  📊 Progress: ${rowCount.toLocaleString()} read, ${stats.totalProcessed.toLocaleString()} processed, ${stats.totalInserted.toLocaleString()} inserted${stats.totalErrors > 0 ? `, ${stats.totalErrors} errors` : ''}...`)
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
  let batchSize: number = 5000

  // Check for --limit flag
  const limitIndex = args.indexOf('--limit')
  if (limitIndex >= 0 && args[limitIndex + 1]) {
    limitRows = parseInt(args[limitIndex + 1])
    args.splice(limitIndex, 2)
  }

  // Check for --batch flag
  const batchIndex = args.indexOf('--batch')
  if (batchIndex >= 0 && args[batchIndex + 1]) {
    batchSize = parseInt(args[batchIndex + 1])
    args.splice(batchIndex, 2)
  } else {
    // Also support --batch=1000 format
    const batchArg = args.find(a => a.startsWith('--batch='));
    if (batchArg) {
      const val = parseInt(batchArg.split('=')[1]);
      if (!isNaN(val)) batchSize = val;
    }
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
  console.log(`   Batch size: ${batchSize}`)
  console.log('='.repeat(60))

  for (const [index, filePath] of filesToImport.entries()) {
    console.log(`\n[${index + 1}/${filesToImport.length}]`)

    if (!fs.existsSync(filePath)) {
      console.error(`  ❌ File not found: ${filePath}`)
      continue
    }

    try {
      await importTSVFile(filePath, { limitRows, chunkSize: batchSize })
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
