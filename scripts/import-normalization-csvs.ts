/**
 * Import Geographic Normalization CSV Files
 *
 * Imports 8 CSV files into the database in the correct order:
 * 1. States → tiger_states
 * 2. Metro Areas → tiger_cbsa
 * 3. County to State → tiger_counties + geo_county_state
 * 4. ZIP to State/Town/Metro → tiger_zcta
 * 5. County to ZIP → geo_zip_county
 * 6. Metro to ZIP → geo_zip_cbsa
 * 7. ZIP Code Demographics → census_demographics
 *
 * Usage: npx tsx scripts/import-normalization-csvs.ts
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import path from 'path'

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DATA_DIR = path.join(process.cwd(), '..', 'data', 'Normalization')
const BATCH_SIZE = 1000

interface ImportStats {
  fileName: string
  rowsRead: number
  rowsInserted: number
  rowsSkipped: number
  errors: string[]
  duration: number
}

const stats: ImportStats[] = []

// Utility functions
function normalizeFIPS(fips: string | number, length: number): string {
  return String(fips).padStart(length, '0')
}

function cleanCountyName(name: string): string {
  return name.replace(/\s+County$/i, '').trim()
}

function convertLSAD(type: string): string | null {
  if (type === 'Metropolitan Statistical Area') return 'M1'
  if (type === 'Micropolitan Statistical Area') return 'M2'
  return null
}

function parseNumber(value: string | number): number | null {
  if (value === '' || value === null || value === undefined) return null
  const num = typeof value === 'string' ? parseFloat(value) : value
  return isNaN(num) ? null : num
}

async function insertBatch(table: string, data: any[], onConflict?: string) {
  if (data.length === 0) return { count: 0, error: null }

  try {
    const { error } = await supabase.from(table).upsert(data, {
      onConflict: onConflict || undefined,
      ignoreDuplicates: false
    })

    if (error) {
      console.error(`Error inserting into ${table}:`, error.message)
      return { count: 0, error: error.message }
    }

    return { count: data.length, error: null }
  } catch (err: any) {
    return { count: 0, error: err.message }
  }
}

// 1. Import States
async function importStates() {
  console.log('\n📍 Step 1: Importing States...')
  const startTime = Date.now()
  const fileName = 'States.csv'
  const filePath = path.join(DATA_DIR, fileName)

  const importStat: ImportStats = {
    fileName,
    rowsRead: 0,
    rowsInserted: 0,
    rowsSkipped: 0,
    errors: [],
    duration: 0
  }

  try {
    const fileContent = readFileSync(filePath, 'utf-8')
    const records = parse(fileContent, { columns: true, skip_empty_lines: true })
    importStat.rowsRead = records.length

    const batch: any[] = []

    for (const row of records) {
      const geoid = normalizeFIPS(row['FIPS code'], 2)
      const population = parseNumber(row['Population'])

      batch.push({
        geoid,
        name: row['State Name'],
        state_abbreviation: row['State Abbreviation'],
        population,
        name_fragment: row['State Name Fragment'],
        created_at: new Date().toISOString()
      })
    }

    const { count, error } = await insertBatch('tiger_states', batch, 'geoid')

    if (error) {
      importStat.errors.push(error)
    } else {
      importStat.rowsInserted = count
    }

  } catch (err: any) {
    importStat.errors.push(err.message)
  }

  importStat.duration = Date.now() - startTime
  stats.push(importStat)

  console.log(`✅ States: ${importStat.rowsInserted}/${importStat.rowsRead} rows (${importStat.duration}ms)`)
  if (importStat.errors.length > 0) {
    console.error(`   Errors: ${importStat.errors.join(', ')}`)
  }
}

// 2. Import Metro Areas (CBSA)
async function importMetroAreas() {
  console.log('\n🏙️  Step 2: Importing Metro Areas...')
  const startTime = Date.now()
  const fileName = 'Metro Areas.csv'
  const filePath = path.join(DATA_DIR, fileName)

  const importStat: ImportStats = {
    fileName,
    rowsRead: 0,
    rowsInserted: 0,
    rowsSkipped: 0,
    errors: [],
    duration: 0
  }

  try {
    const fileContent = readFileSync(filePath, 'utf-8')
    const records = parse(fileContent, { columns: true, skip_empty_lines: true })
    importStat.rowsRead = records.length

    const batch: any[] = []

    for (const row of records) {
      const geoid = normalizeFIPS(row['CBSA Code'], 5)
      const population = parseNumber(row['Population'])
      const lsad = convertLSAD(row['Metropolitan/Micropolitan Statistical Area'])

      batch.push({
        geoid,
        name: row['Name (CSBA)'],
        lsad,
        population,
        created_at: new Date().toISOString()
      })
    }

    const { count, error } = await insertBatch('tiger_cbsa', batch, 'geoid')

    if (error) {
      importStat.errors.push(error)
    } else {
      importStat.rowsInserted = count
    }

  } catch (err: any) {
    importStat.errors.push(err.message)
  }

  importStat.duration = Date.now() - startTime
  stats.push(importStat)

  console.log(`✅ Metro Areas: ${importStat.rowsInserted}/${importStat.rowsRead} rows (${importStat.duration}ms)`)
  if (importStat.errors.length > 0) {
    console.error(`   Errors: ${importStat.errors.join(', ')}`)
  }
}

// 3. Import Counties
async function importCounties() {
  console.log('\n🏘️  Step 3: Importing Counties...')
  const startTime = Date.now()
  const fileName = 'County to State.csv'
  const filePath = path.join(DATA_DIR, fileName)

  const importStat: ImportStats = {
    fileName,
    rowsRead: 0,
    rowsInserted: 0,
    rowsSkipped: 0,
    errors: [],
    duration: 0
  }

  try {
    const fileContent = readFileSync(filePath, 'utf-8')
    const records = parse(fileContent, { columns: true, skip_empty_lines: true })
    importStat.rowsRead = records.length

    const countyBatch: any[] = []
    const relationshipBatch: any[] = []

    for (const row of records) {
      const countyFips = normalizeFIPS(row['FIPS - County Code'], 5)
      const stateFips = countyFips.substring(0, 2)
      const population = parseNumber(row['County Population'])
      const pctOfState = parseNumber(row['County % of State Population'])

      countyBatch.push({
        geoid: countyFips,
        name: cleanCountyName(row['County']),
        state_fips: stateFips,
        population,
        county_name_fragment: row['County Name Fragment'],
        pct_of_state_population: pctOfState,
        created_at: new Date().toISOString()
      })

      relationshipBatch.push({
        county_geoid: countyFips,
        state_geoid: stateFips,
        created_at: new Date().toISOString()
      })
    }

    // Insert counties
    const { count: countyCount, error: countyError } = await insertBatch('tiger_counties', countyBatch, 'geoid')

    if (countyError) {
      importStat.errors.push(`Counties: ${countyError}`)
    } else {
      importStat.rowsInserted = countyCount
    }

    // Insert county-state relationships
    const { error: relError } = await insertBatch('geo_county_state', relationshipBatch, 'county_geoid,state_geoid')

    if (relError) {
      importStat.errors.push(`Relationships: ${relError}`)
    }

  } catch (err: any) {
    importStat.errors.push(err.message)
  }

  importStat.duration = Date.now() - startTime
  stats.push(importStat)

  console.log(`✅ Counties: ${importStat.rowsInserted}/${importStat.rowsRead} rows (${importStat.duration}ms)`)
  if (importStat.errors.length > 0) {
    console.error(`   Errors: ${importStat.errors.join(', ')}`)
  }
}

// 4. Import ZIP Codes
async function importZIPCodes() {
  console.log('\n📮 Step 4: Importing ZIP Codes...')
  const startTime = Date.now()
  const fileName = 'ZIP to State, Town, Metro.csv'
  const filePath = path.join(DATA_DIR, fileName)

  const importStat: ImportStats = {
    fileName,
    rowsRead: 0,
    rowsInserted: 0,
    rowsSkipped: 0,
    errors: [],
    duration: 0
  }

  try {
    const fileContent = readFileSync(filePath, 'utf-8')
    const records = parse(fileContent, { columns: true, skip_empty_lines: true })
    importStat.rowsRead = records.length

    const batch: any[] = []

    for (const row of records) {
      const geoid = normalizeFIPS(row['ZIP Code'], 5)
      const population = parseNumber(row['ZIP Code Population'])
      const cbsaCode = row['CBSA Code'] ? normalizeFIPS(row['CBSA Code'], 5) : null

      batch.push({
        geoid,
        population,
        default_city: row['USPS Default City for ZIP'],
        default_state: row['USPS Default State for ZIP'],
        cbsa_code: cbsaCode,
        created_at: new Date().toISOString()
      })
    }

    const { count, error } = await insertBatch('tiger_zcta', batch, 'geoid')

    if (error) {
      importStat.errors.push(error)
    } else {
      importStat.rowsInserted = count
    }

  } catch (err: any) {
    importStat.errors.push(err.message)
  }

  importStat.duration = Date.now() - startTime
  stats.push(importStat)

  console.log(`✅ ZIP Codes: ${importStat.rowsInserted}/${importStat.rowsRead} rows (${importStat.duration}ms)`)
  if (importStat.errors.length > 0) {
    console.error(`   Errors: ${importStat.errors.join(', ')}`)
  }
}

// 5. Import ZIP-County Relationships
async function importZIPCounty() {
  console.log('\n🔗 Step 5: Importing ZIP-County Relationships...')
  const startTime = Date.now()
  const fileName = 'Zip to County.csv'
  const filePath = path.join(DATA_DIR, fileName)

  const importStat: ImportStats = {
    fileName,
    rowsRead: 0,
    rowsInserted: 0,
    rowsSkipped: 0,
    errors: [],
    duration: 0
  }

  try {
    const fileContent = readFileSync(filePath, 'utf-8')
    const records = parse(fileContent, { columns: true, skip_empty_lines: true })
    importStat.rowsRead = records.length

    let totalInserted = 0

    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map((row: any) => {
        const zipGeoid = normalizeFIPS(row['ZIP'], 5)
        const countyGeoid = normalizeFIPS(row['COUNTY Code'], 5)
        const overlapPct = parseNumber(row['% of ZIP Residents in County'])
        const isPrimary = overlapPct && overlapPct >= 0.5

        return {
          zip_geoid: zipGeoid,
          county_geoid: countyGeoid,
          overlap_percentage: overlapPct || 0,
          is_primary: isPrimary,
          created_at: new Date().toISOString()
        }
      })

      const { count, error } = await insertBatch('geo_zip_county', batch, 'zip_geoid,county_geoid')

      if (error) {
        importStat.errors.push(`Batch ${i / BATCH_SIZE + 1}: ${error}`)
      } else {
        totalInserted += count
      }

      console.log(`   Processed ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} rows...`)
    }

    importStat.rowsInserted = totalInserted

  } catch (err: any) {
    importStat.errors.push(err.message)
  }

  importStat.duration = Date.now() - startTime
  stats.push(importStat)

  console.log(`✅ ZIP-County: ${importStat.rowsInserted}/${importStat.rowsRead} rows (${importStat.duration}ms)`)
  if (importStat.errors.length > 0) {
    console.error(`   Errors: ${importStat.errors.join(', ')}`)
  }
}

// 6. Import ZIP-Metro Relationships
async function importZIPMetro() {
  console.log('\n🔗 Step 6: Importing ZIP-Metro Relationships...')
  const startTime = Date.now()
  const fileName = 'Metro to ZIP Code.csv'
  const filePath = path.join(DATA_DIR, fileName)

  const importStat: ImportStats = {
    fileName,
    rowsRead: 0,
    rowsInserted: 0,
    rowsSkipped: 0,
    errors: [],
    duration: 0
  }

  try {
    const fileContent = readFileSync(filePath, 'utf-8')
    const records = parse(fileContent, { columns: true, skip_empty_lines: true })
    importStat.rowsRead = records.length

    let totalInserted = 0

    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map((row: any) => {
        const zipGeoid = normalizeFIPS(row['ZIP'], 5)
        const cbsaGeoid = normalizeFIPS(row['CBSA Code'], 5)
        const overlapPct = parseNumber(row['% of Metro Residents in ZIP'])
        const isPrimary = overlapPct && overlapPct >= 0.01 // Top 1% of metro population

        return {
          zip_geoid: zipGeoid,
          cbsa_geoid: cbsaGeoid,
          overlap_percentage: overlapPct || 0,
          is_primary: isPrimary,
          created_at: new Date().toISOString()
        }
      })

      const { count, error } = await insertBatch('geo_zip_cbsa', batch, 'zip_geoid,cbsa_geoid')

      if (error) {
        importStat.errors.push(`Batch ${i / BATCH_SIZE + 1}: ${error}`)
      } else {
        totalInserted += count
      }

      console.log(`   Processed ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} rows...`)
    }

    importStat.rowsInserted = totalInserted

  } catch (err: any) {
    importStat.errors.push(err.message)
  }

  importStat.duration = Date.now() - startTime
  stats.push(importStat)

  console.log(`✅ ZIP-Metro: ${importStat.rowsInserted}/${importStat.rowsRead} rows (${importStat.duration}ms)`)
  if (importStat.errors.length > 0) {
    console.error(`   Errors: ${importStat.errors.join(', ')}`)
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Geographic Normalization CSV Import')
  console.log(`📂 Data directory: ${DATA_DIR}`)
  console.log(`🔗 Supabase URL: ${supabaseUrl}`)

  const overallStart = Date.now()

  try {
    await importStates()
    await importMetroAreas()
    await importCounties()
    await importZIPCodes()
    await importZIPCounty()
    await importZIPMetro()

    const overallDuration = Date.now() - overallStart

    console.log('\n' + '='.repeat(60))
    console.log('📊 IMPORT SUMMARY')
    console.log('='.repeat(60))

    let totalRead = 0
    let totalInserted = 0
    let totalErrors = 0

    stats.forEach(stat => {
      totalRead += stat.rowsRead
      totalInserted += stat.rowsInserted
      totalErrors += stat.errors.length

      const success = stat.rowsInserted === stat.rowsRead ? '✅' : '⚠️'
      console.log(`${success} ${stat.fileName}:`)
      console.log(`   Read: ${stat.rowsRead.toLocaleString()}`)
      console.log(`   Inserted: ${stat.rowsInserted.toLocaleString()}`)
      console.log(`   Duration: ${stat.duration}ms`)
      if (stat.errors.length > 0) {
        console.log(`   Errors: ${stat.errors.length}`)
      }
    })

    console.log('='.repeat(60))
    console.log(`Total rows read: ${totalRead.toLocaleString()}`)
    console.log(`Total rows inserted: ${totalInserted.toLocaleString()}`)
    console.log(`Total errors: ${totalErrors}`)
    console.log(`Overall duration: ${(overallDuration / 1000).toFixed(2)}s`)
    console.log('='.repeat(60))

    if (totalErrors > 0) {
      console.log('\n⚠️  Import completed with errors. Review logs above.')
      process.exit(1)
    } else {
      console.log('\n✅ Import completed successfully!')
      process.exit(0)
    }

  } catch (err: any) {
    console.error('\n❌ Fatal error during import:', err.message)
    process.exit(1)
  }
}

main()
