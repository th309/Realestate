#!/usr/bin/env node
/**
 * Load TIGER shapefiles and GeoJSON files directly to Supabase PostGIS
 * No GDAL required - uses Node.js shapefile library for .shp files
 * Supports both .shp (shapefiles) and .geojson/.json files
 * 
 * Usage:
 *   npm run load-shapefiles -- --project-ref YOUR_PROJECT_REF
 *   npm run load-shapefiles -- --file path/to/file.shp --table table_name
 *   npm run load-shapefiles -- --file path/to/file.geojson --table table_name
 */

import * as fs from 'fs'
import * as path from 'path'
import { open } from 'shapefile'
import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'
import * as dotenv from 'dotenv'

// Load environment variables from multiple possible locations
const envPaths = [
  path.join(__dirname, '..', 'web', '.env.local'),
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '.env')
]

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
    break
  }
}

interface LoadOptions {
  projectRef?: string
  dbPassword?: string
  shapefilePath?: string
  tableName?: string
  geometryColumn?: string
  geoidField?: string
  batchSize?: number
}

interface LoadResult {
  success: boolean
  loaded: number
  errors: number
  errorMessages: string[]
}

/**
 * Get Supabase client with admin access
 */
function getSupabaseClient(projectRef: string, dbPassword: string) {
  const supabaseUrl = `https://${projectRef}.supabase.co`
  
  // Try to get service role key first (has full access)
  // Then try anon key (limited access)
  // Prioritize service role key for admin operations
  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  
  if (!supabaseKey) {
    throw new Error(
      'Missing Supabase key in environment.\n' +
      'Please set SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local\n' +
      'Service role key is required for INSERT operations via exec_sql RPC'
    )
  }

  // Warn if using anon key instead of service role key
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  WARNING: Using anon key instead of service role key.')
    console.warn('   This may cause permission errors. Use SUPABASE_SERVICE_ROLE_KEY for admin operations.')
  } else {
    console.log('✅ Using service role key for admin operations')
  }

  return createClient(supabaseUrl, supabaseKey)
}

/**
 * Prompt for password securely
 */
function promptPassword(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    rl.question('Enter Supabase database password: ', (password) => {
      rl.close()
      resolve(password)
    })
  })
}

/**
 * Execute SQL via Supabase RPC (if exec_sql function exists)
 * Otherwise, use direct SQL execution
 */
async function executeSQL(
  supabase: any,
  query: string,
  dbPassword: string,
  projectRef: string
): Promise<{ error: any }> {
  // Try RPC first (if exec_sql function exists)
  const { data, error: rpcError } = await supabase.rpc('exec_sql', { query })
  
  if (!rpcError) {
    return { error: null }
  }

  // Log the actual error for debugging
  const errorMsg = rpcError.message || rpcError.toString() || JSON.stringify(rpcError)
  console.error('❌ RPC exec_sql error:', errorMsg)
  console.error('   Query preview:', query.substring(0, 200) + '...')
  
  // Return the error so caller can handle it
  return { error: rpcError }
}

/**
 * Load a GeoJSON file to Supabase
 */
async function loadGeoJSON(
  geojsonPath: string,
  tableName: string,
  options: LoadOptions
): Promise<LoadResult> {
  const {
    projectRef = 'pysflbhpnqwoczyuaaif',
    dbPassword,
    geometryColumn = 'geom',
    geoidField = 'GEOID',
    batchSize = 10
  } = options

  if (!fs.existsSync(geojsonPath)) {
    throw new Error(`GeoJSON file not found: ${geojsonPath}`)
  }

  // Get database password (only needed if no API key is available)
  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  
  let password = dbPassword
  if (!password && !supabaseKey) {
    password = await promptPassword()
  } else {
    // Use empty password if we have API key
    password = password || ''
  }

  // Create Supabase client
  const supabase = getSupabaseClient(projectRef, password)

  console.log(`\n📂 Loading GeoJSON: ${path.basename(geojsonPath)}`)
  console.log(`   Table: ${tableName}`)
  console.log(`   Geometry column: ${geometryColumn}`)
  console.log(`   Batch size: ${batchSize}\n`)

  // Read and parse GeoJSON
  const fileContent = fs.readFileSync(geojsonPath, 'utf-8')
  const geojson = JSON.parse(fileContent)

  if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('Invalid GeoJSON format. Expected FeatureCollection with features array.')
  }

  const features = geojson.features
  console.log(`   Found ${features.length} features\n`)

  let loaded = 0
  let errors = 0
  const errorMessages: string[] = []

  // Process features in batches
  for (let i = 0; i < features.length; i += batchSize) {
    const batch = features.slice(i, i + batchSize)
    
    const batchResult = await loadBatch(
      batch,
      tableName,
      geometryColumn,
      geoidField,
      supabase,
      password,
      projectRef
    )
    
    loaded += batchResult.loaded
    errors += batchResult.errors
    errorMessages.push(...batchResult.errorMessages)

    // Progress update
    if ((i + batchSize) % 100 === 0 || i + batchSize >= features.length) {
      process.stdout.write(`\r   Processed ${Math.min(i + batchSize, features.length)}/${features.length}... (Loaded: ${loaded}, Errors: ${errors})`)
    }
  }

  console.log(`\n\n✅ Complete!`)
  console.log(`   Total features: ${features.length}`)
  console.log(`   Loaded: ${loaded}`)
  console.log(`   Errors: ${errors}`)

  return {
    success: errors === 0,
    loaded,
    errors,
    errorMessages: errorMessages.slice(0, 10)
  }
}

/**
 * Load a single shapefile to Supabase
 */
async function loadShapefile(
  shapefilePath: string,
  tableName: string,
  options: LoadOptions
): Promise<LoadResult> {
  const {
    projectRef = 'pysflbhpnqwoczyuaaif',
    dbPassword,
    geometryColumn = 'geom',
    geoidField = 'GEOID',
    batchSize = tableName === 'tiger_zcta' ? 20 : 10  // Much smaller batches for ZCTA due to large geometries
  } = options

  if (!fs.existsSync(shapefilePath)) {
    throw new Error(`Shapefile not found: ${shapefilePath}`)
  }

  // Verify required shapefile component files exist
  // Shapefiles consist of multiple files: .shp (geometry), .shx (index), .dbf (attributes)
  const basePath = shapefilePath.replace(/\.shp$/i, '')
  const requiredFiles = {
    shp: `${basePath}.shp`,
    shx: `${basePath}.shx`,  // Index file (required)
    dbf: `${basePath}.dbf`   // Attribute data (required)
  }
  
  const missingFiles: string[] = []
  for (const [type, filePath] of Object.entries(requiredFiles)) {
    if (!fs.existsSync(filePath)) {
      missingFiles.push(`${type.toUpperCase()} (${path.basename(filePath)})`)
    }
  }
  
  if (missingFiles.length > 0) {
    throw new Error(
      `Missing required shapefile component files:\n` +
      `  ${missingFiles.join('\n  ')}\n\n` +
      `Shapefiles require multiple files (.shp, .shx, .dbf) in the same directory.\n` +
      `Make sure all files from the unzipped shapefile are present.`
    )
  }

  // Optional files (informational)
  const optionalFiles = {
    prj: `${basePath}.prj`,  // Projection/CRS info
    cpg: `${basePath}.cpg`   // Code page/encoding
  }
  
  const presentOptional: string[] = []
  for (const [type, filePath] of Object.entries(optionalFiles)) {
    if (fs.existsSync(filePath)) {
      presentOptional.push(type.toUpperCase())
    }
  }

  // Get database password (only needed if no API key is available)
  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  
  let password = dbPassword
  if (!password && !supabaseKey) {
    password = await promptPassword()
  } else {
    // Use empty password if we have API key
    password = password || ''
  }

  // Create Supabase client
  const supabase = getSupabaseClient(projectRef, password)

  console.log(`\n📂 Loading Shapefile: ${path.basename(shapefilePath)}`)
  console.log(`   Table: ${tableName}`)
  console.log(`   Geometry column: ${geometryColumn}`)
  console.log(`   Batch size: ${batchSize}`)
  if (presentOptional.length > 0) {
    console.log(`   Optional files found: ${presentOptional.join(', ')}`)
  }
  console.log()

  // Open shapefile (the shapefile library automatically reads .shx and .dbf)
  const source = await open(shapefilePath)
  
  let loaded = 0
  let errors = 0
  const errorMessages: string[] = []
  let batch: any[] = []
  let featureCount = 0

  try {
    // Read features in batches
    while (true) {
      const result = await source.read()
      
      if (result.done) {
        // Process remaining batch
        if (batch.length > 0) {
          const batchResult = await loadBatch(
            batch,
            tableName,
            geometryColumn,
            geoidField,
            supabase,
            password,
            projectRef
          )
          loaded += batchResult.loaded
          errors += batchResult.errors
          errorMessages.push(...batchResult.errorMessages)
        }
        break
      }

      batch.push(result.value)
      featureCount++

      // Process batch when it reaches batchSize
      if (batch.length >= batchSize) {
        const batchResult = await loadBatch(
          batch,
          tableName,
          geometryColumn,
          geoidField,
          supabase,
          password,
          projectRef
        )
        loaded += batchResult.loaded
        errors += batchResult.errors
        errorMessages.push(...batchResult.errorMessages)
        
        batch = [] // Reset batch
        
        // Progress update
        if (featureCount % 100 === 0) {
          process.stdout.write(`\r   Processed ${featureCount} features... (Loaded: ${loaded}, Errors: ${errors})`)
        }
      }
    }

    console.log(`\n\n✅ Complete!`)
    console.log(`   Total features: ${featureCount}`)
    console.log(`   Loaded: ${loaded}`)
    console.log(`   Errors: ${errors}`)
    if (skipped > 0) {
      console.log(`   Skipped (already loaded): ${skipped}`)
    }

  } finally {
    if (source.close) {
      await source.close()
    }
  }

  return {
    success: errors === 0,
    loaded,
    errors,
    errorMessages: errorMessages.slice(0, 10)
  }
}

/**
 * Load a geographic file (shapefile or GeoJSON) to Supabase
 * Automatically detects file type based on extension
 */
async function loadGeographicFile(
  filePath: string,
  tableName: string,
  options: LoadOptions
): Promise<LoadResult> {
  const ext = path.extname(filePath).toLowerCase()
  
  if (ext === '.geojson' || ext === '.json') {
    return loadGeoJSON(filePath, tableName, options)
  } else if (ext === '.shp') {
    return loadShapefile(filePath, tableName, options)
  } else {
    throw new Error(`Unsupported file type: ${ext}. Supported: .shp, .geojson, .json`)
  }
}

/**
 * Load a batch of features to Supabase
 */
async function loadBatch(
  features: any[],
  tableName: string,
  geometryColumn: string,
  geoidField: string,
  supabase: any,
  dbPassword: string,
  projectRef: string
): Promise<{ loaded: number; errors: number; errorMessages: string[] }> {
  const values: string[] = []
  const geoids: string[] = []

  for (const feature of features) {
    const geoid = feature.properties?.[geoidField] || 
                  feature.properties?.GEOID || 
                  feature.properties?.CBSAFP ||
                  feature.properties?.GEOID20
    
    if (!geoid || !feature.geometry) {
      continue
    }

    geoids.push(geoid)
    
    // Escape single quotes in GeoJSON and escape backslashes
    const geoJsonStr = JSON.stringify(feature.geometry)
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/'/g, "''")      // Escape single quotes
    
    // Build INSERT value
    // Use ST_Multi to ensure MultiPolygon type (required by table schema)
    // Also extract name from properties if available
    // Note: tiger_zcta table doesn't have a name column, so skip it
    const name = (tableName === 'tiger_zcta') ? null : (feature.properties?.NAME || feature.properties?.name || '')
    const nameEscaped = name ? name.replace(/'/g, "''") : ''
    
    if (name && tableName !== 'tiger_zcta') {
      values.push(
        `('${geoid}', '${nameEscaped}', ST_Multi(ST_GeomFromGeoJSON('${geoJsonStr}')::geometry))`
      )
    } else {
      // For tiger_zcta or when no name, don't include name in the INSERT
      values.push(
        `('${geoid}', ST_Multi(ST_GeomFromGeoJSON('${geoJsonStr}')::geometry))`
      )
    }
  }

  if (values.length === 0) {
    return { loaded: 0, errors: 0, errorMessages: [] }
  }

  // Build INSERT SQL
  // Check if we have name values by looking for the pattern: ('geoid', 'name', ...) or ('geoid', NULL, ...)
  // For tiger_zcta, we never include name
  const firstValue = values[0] || ''
  const hasName = tableName !== 'tiger_zcta' && (firstValue.includes("', '") || firstValue.includes("', NULL"))
  
  if (hasName) {
    // Try with name column first
    const insertSql = `
      INSERT INTO ${tableName} (geoid, name, ${geometryColumn})
      VALUES ${values.join(', ')}
      ON CONFLICT (geoid) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        ${geometryColumn} = EXCLUDED.${geometryColumn}
    `
    
    try {
      const { error } = await executeSQL(supabase, insertSql, dbPassword, projectRef)
      
      if (error) {
        // If that fails, try without name column
        // Extract just geoid and geometry from values
        const valuesWithoutName = values.map(v => {
          // Match: ('geoid', 'name', geometry) -> ('geoid', geometry)
          const match = v.match(/\(([^,]+),\s*[^,]+,\s*([^)]+)\)/)
          if (match) {
            return `(${match[1]}, ${match[2]})` // geoid, geometry
          }
          return v // Fallback if pattern doesn't match
        })
        
        const insertSqlNoName = `
          INSERT INTO ${tableName} (geoid, ${geometryColumn})
          VALUES ${valuesWithoutName.join(', ')}
          ON CONFLICT (geoid) 
          DO UPDATE SET ${geometryColumn} = EXCLUDED.${geometryColumn}
        `
        
        const { error: error2 } = await executeSQL(supabase, insertSqlNoName, dbPassword, projectRef)
        return handleSQLResult(error2, geoids.length)
      }
      
      return { loaded: geoids.length, errors: 0, errorMessages: [] }
    } catch (error: any) {
      return handleSQLResult(error, geoids.length)
    }
  } else {
    // No name column, just geoid and geometry
    const insertSql = `
      INSERT INTO ${tableName} (geoid, ${geometryColumn})
      VALUES ${values.join(', ')}
      ON CONFLICT (geoid) 
      DO UPDATE SET ${geometryColumn} = EXCLUDED.${geometryColumn}
    `
    
    try {
      const { error } = await executeSQL(supabase, insertSql, dbPassword, projectRef)
      return handleSQLResult(error, geoids.length)
    } catch (error: any) {
      return handleSQLResult(error, geoids.length)
    }
  }
}

/**
 * Handle SQL execution result
 */
function handleSQLResult(error: any, count: number): { loaded: number; errors: number; errorMessages: string[] } {
  if (error) {
    const errorMsg = error.message || error.toString()
    console.error(`   SQL Error: ${errorMsg.substring(0, 200)}`)
    return {
      loaded: 0,
      errors: count,
      errorMessages: [errorMsg.substring(0, 200)]
    }
  }
  
  return {
    loaded: count,
    errors: 0,
    errorMessages: []
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  const options: LoadOptions = {}

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project-ref' && args[i + 1]) {
      options.projectRef = args[i + 1]
      i++
    } else if (args[i] === '--file' && args[i + 1]) {
      options.shapefilePath = args[i + 1]
      i++
    } else if (args[i] === '--table' && args[i + 1]) {
      options.tableName = args[i + 1]
      i++
    } else if (args[i] === '--geometry-column' && args[i + 1]) {
      options.geometryColumn = args[i + 1]
      i++
    } else if (args[i] === '--geoid-field' && args[i + 1]) {
      options.geoidField = args[i + 1]
      i++
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      options.batchSize = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--password' && args[i + 1]) {
      options.dbPassword = args[i + 1]
      i++
    }
  }

  console.log('========================================')
  console.log('  Load Shapefiles to Supabase')
  console.log('  (No GDAL Required)')
  console.log('========================================\n')

  // If specific file provided, load it (supports both shapefiles and GeoJSON)
  if (options.shapefilePath && options.tableName) {
    const result = await loadGeographicFile(
      options.shapefilePath,
      options.tableName,
      options
    )
    
    process.exit(result.success ? 0 : 1)
    return
  }

  // Otherwise, load all TIGER files
  const scriptDir = __dirname
  const tigerDir = path.join(scriptDir, '..', 'data', 'tiger')
  
  if (!fs.existsSync(tigerDir)) {
    console.error(`❌ TIGER directory not found: ${tigerDir}`)
    process.exit(1)
  }

  const filesToLoad = [
    { file: 'tl_2024_us_state.shp', table: 'tiger_states', geoid: 'GEOID' },
    { file: 'tl_2024_us_county.shp', table: 'tiger_counties', geoid: 'GEOID' },
    { file: 'tl_2024_us_cbsa.shp', table: 'tiger_cbsa', geoid: 'GEOID' },
    { file: 'tl_2024_us_zcta520.shp', table: 'tiger_zcta', geoid: 'GEOID20' },
  ]

  console.log('Loading all TIGER shapefiles...\n')

  let totalLoaded = 0
  let totalErrors = 0

  for (const { file, table, geoid } of filesToLoad) {
    const filePath = path.join(tigerDir, file)
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Skipping ${file} (not found)`)
      continue
    }

    const result = await loadGeographicFile(filePath, table, {
      ...options,
      geoidField: geoid
    })

    totalLoaded += result.loaded
    totalErrors += result.errors
  }

  // Load places (all state files)
  console.log('\n📂 Loading Places (this may take a while)...\n')
  const placeFiles = fs.readdirSync(tigerDir)
    .filter(f => f.startsWith('tl_2024_') && f.endsWith('_place.shp'))
    .map(f => path.join(tigerDir, f))

  if (placeFiles.length > 0) {
    console.log(`   Found ${placeFiles.length} place files\n`)

    // Load first file (creates table)
    if (placeFiles.length > 0) {
      const firstResult = await loadGeographicFile(placeFiles[0], 'tiger_places', {
        ...options,
        geoidField: 'GEOID'
      })
      totalLoaded += firstResult.loaded
      totalErrors += firstResult.errors

      // Append remaining files (ON CONFLICT handles duplicates)
      for (let i = 1; i < placeFiles.length; i++) {
        console.log(`   Loading ${path.basename(placeFiles[i])}...`)
        const appendResult = await loadGeographicFile(placeFiles[i], 'tiger_places', {
          ...options,
          geoidField: 'GEOID'
        })
        totalLoaded += appendResult.loaded
        totalErrors += appendResult.errors
      }
    }
  }

  console.log('\n========================================')
  console.log('  Summary')
  console.log('========================================')
  console.log(`✅ Total loaded: ${totalLoaded}`)
  console.log(`❌ Total errors: ${totalErrors}`)
  console.log('')

  process.exit(totalErrors === 0 ? 0 : 1)
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { loadShapefile, loadGeoJSON, loadGeographicFile, LoadOptions, LoadResult }

