import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { open } from 'shapefile'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'

/**
 * Admin API endpoint for uploading geographic data (shapefiles or GeoJSON)
 * POST /api/admin/upload-geographic-data
 * 
 * Supports:
 * - Shapefiles (uploaded as ZIP containing .shp, .shx, .dbf, etc.)
 * - GeoJSON files (.geojson, .json)
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // const user = await getCurrentUser(request)
    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileType = (formData.get('fileType') as string) || 'auto'
    const tableName = formData.get('tableName') as string
    const geometryColumn = (formData.get('geometryColumn') as string) || 'geom'
    const geoidField = (formData.get('geoidField') as string) || 'GEOID'
    const batchSize = formData.get('batchSize') 
      ? parseInt(formData.get('batchSize') as string) 
      : 10
    const overwrite = formData.get('overwrite') === 'true'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!tableName) {
      return NextResponse.json(
        { success: false, error: 'Table name is required' },
        { status: 400 }
      )
    }

    // Create temp directory for processing
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'geo-upload-'))
    
    try {
      const fileName = file.name
      const fileExt = path.extname(fileName).toLowerCase()
      
      // Determine file type if auto-detect
      let detectedType: 'shapefile' | 'geojson' = 'geojson'
      if (fileType === 'auto') {
        if (fileExt === '.zip' || fileName.toLowerCase().includes('shapefile')) {
          detectedType = 'shapefile'
        } else if (fileExt === '.geojson' || fileExt === '.json') {
          detectedType = 'geojson'
        }
      } else {
        detectedType = fileType as 'shapefile' | 'geojson'
      }

      // Save uploaded file to temp directory
      const tempFilePath = path.join(tempDir, fileName)
      const fileBuffer = await file.arrayBuffer()
      await fs.promises.writeFile(tempFilePath, Buffer.from(fileBuffer))

      let result: {
        success: boolean
        loaded: number
        errors: number
        totalFeatures: number
        geometryColumn: string
        geoidField: string
        errorMessages: string[]
        warnings: string[]
      }

      if (detectedType === 'shapefile') {
        // Handle shapefile (ZIP)
        result = await processShapefileUpload(
          tempFilePath,
          tempDir,
          tableName,
          geometryColumn,
          geoidField,
          batchSize,
          overwrite
        )
      } else {
        // Handle GeoJSON
        result = await processGeoJSONUpload(
          tempFilePath,
          tableName,
          geometryColumn,
          geoidField,
          batchSize,
          overwrite
        )
      }

      return NextResponse.json(result)
    } finally {
      // Cleanup temp directory
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    }
  } catch (error: any) {
    console.error('Error processing geographic upload:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to process upload',
        loaded: 0,
        errors: 0,
        totalFeatures: 0,
        errorMessages: [error.message]
      },
      { status: 500 }
    )
  }
}

/**
 * Process shapefile upload (ZIP file)
 */
async function processShapefileUpload(
  zipPath: string,
  extractDir: string,
  tableName: string,
  geometryColumn: string,
  geoidField: string,
  batchSize: number,
  overwrite: boolean
) {
  console.log(`Extracting ZIP file: ${zipPath}`)
  
  // Extract ZIP file
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(extractDir, true) // Overwrite existing files
  
  console.log(`ZIP extracted to: ${extractDir}`)
  
  // Find .shp file(s) in extracted directory (recursively)
  const findShpFiles = async (dir: string, baseDir: string = dir): Promise<string[]> => {
    const files: string[] = []
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const subFiles = await findShpFiles(fullPath, baseDir)
        files.push(...subFiles)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.shp')) {
        files.push(fullPath)
      }
    }
    
    return files
  }
  
  const shpFiles = await findShpFiles(extractDir)
  
  if (shpFiles.length === 0) {
    throw new Error(
      'No .shp file found in uploaded ZIP.\n' +
      'Make sure the ZIP contains a shapefile with all required components (.shp, .shx, .dbf).'
    )
  }
  
  if (shpFiles.length > 1) {
    console.warn(`Multiple .shp files found: ${shpFiles.map(f => path.basename(f)).join(', ')}. Using the first one.`)
  }
  
  // Use the first .shp file found
  const shpPath = shpFiles[0]
  
  console.log(`Processing shapefile: ${shpPath}`)
  
  // Validate required component files
  // Get the base path (without .shp extension)
  const basePath = shpPath.replace(/\.shp$/i, '')
  const baseDir = path.dirname(basePath)
  const baseName = path.basename(basePath)
  
  const requiredFiles = {
    shx: path.join(baseDir, `${baseName}.shx`),
    dbf: path.join(baseDir, `${baseName}.dbf`)
  }
  
  const missing: string[] = []
  for (const [type, filePath] of Object.entries(requiredFiles)) {
    if (!fs.existsSync(filePath)) {
      missing.push(type.toUpperCase())
      console.error(`Missing required file: ${filePath}`)
    }
  }
  
  if (missing.length > 0) {
    // List available files in the directory for debugging
    const availableFiles = await fs.promises.readdir(baseDir)
    const availableShp = availableFiles.filter(f => f.toLowerCase().startsWith(baseName.toLowerCase()))
    
    throw new Error(
      `Missing required shapefile component files: ${missing.join(', ')}\n\n` +
      `Required files:\n` +
      `  - ${path.basename(requiredFiles.shx)}\n` +
      `  - ${path.basename(requiredFiles.dbf)}\n\n` +
      `Available files with matching base name:\n` +
      `  ${availableShp.map(f => `- ${f}`).join('\n  ')}\n\n` +
      `Make sure the ZIP contains all shapefile components (.shp, .shx, .dbf) in the same directory.`
    )
  }
  
  // Check for optional files
  const optionalFiles = {
    prj: path.join(baseDir, `${baseName}.prj`),
    cpg: path.join(baseDir, `${baseName}.cpg`)
  }
  
  const presentOptional: string[] = []
  for (const [type, filePath] of Object.entries(optionalFiles)) {
    if (fs.existsSync(filePath)) {
      presentOptional.push(type.toUpperCase())
    }
  }
  
  if (presentOptional.length > 0) {
    console.log(`Optional files found: ${presentOptional.join(', ')}`)
  }

  // Process shapefile
  return await loadShapefileToSupabase(
    shpPath,
    tableName,
    geometryColumn,
    geoidField,
    batchSize,
    overwrite
  )
}

/**
 * Process GeoJSON upload
 */
async function processGeoJSONUpload(
  filePath: string,
  tableName: string,
  geometryColumn: string,
  geoidField: string,
  batchSize: number,
  overwrite: boolean
) {
  const fileContent = await fs.promises.readFile(filePath, 'utf-8')
  const geojson = JSON.parse(fileContent)

  if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('Invalid GeoJSON format. Expected FeatureCollection with features array.')
  }

  return await loadGeoJSONToSupabase(
    geojson.features,
    tableName,
    geometryColumn,
    geoidField,
    batchSize,
    overwrite
  )
}

/**
 * Load shapefile to Supabase
 */
async function loadShapefileToSupabase(
  shpPath: string,
  tableName: string,
  geometryColumn: string,
  geoidField: string,
  batchSize: number,
  overwrite: boolean
) {
  const supabase = createSupabaseAdminClient()
  const source = await open(shpPath)
  
  let loaded = 0
  let errors = 0
  const errorMessages: string[] = []
  let batch: any[] = []
  let featureCount = 0

  try {
    while (true) {
      const result = await source.read()
      
      if (result.done) {
        if (batch.length > 0) {
          const batchResult = await loadBatch(
            batch,
            tableName,
            geometryColumn,
            geoidField,
            supabase,
            overwrite
          )
          loaded += batchResult.loaded
          errors += batchResult.errors
          errorMessages.push(...batchResult.errorMessages)
        }
        break
      }

      batch.push(result.value)
      featureCount++

      if (batch.length >= batchSize) {
        const batchResult = await loadBatch(
          batch,
          tableName,
          geometryColumn,
          geoidField,
          supabase,
          overwrite
        )
        loaded += batchResult.loaded
        errors += batchResult.errors
        errorMessages.push(...batchResult.errorMessages)
        batch = []
      }
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
    totalFeatures: featureCount,
    geometryColumn,
    geoidField,
    errorMessages: errorMessages.slice(0, 10),
    warnings: []
  }
}

/**
 * Load GeoJSON features to Supabase
 */
async function loadGeoJSONToSupabase(
  features: any[],
  tableName: string,
  geometryColumn: string,
  geoidField: string,
  batchSize: number,
  overwrite: boolean
) {
  const supabase = createSupabaseAdminClient()
  
  let loaded = 0
  let errors = 0
  const errorMessages: string[] = []

  for (let i = 0; i < features.length; i += batchSize) {
    const batch = features.slice(i, i + batchSize)
    
    const batchResult = await loadBatch(
      batch,
      tableName,
      geometryColumn,
      geoidField,
      supabase,
      overwrite
    )
    
    loaded += batchResult.loaded
    errors += batchResult.errors
    errorMessages.push(...batchResult.errorMessages)
  }

  return {
    success: errors === 0,
    loaded,
    errors,
    totalFeatures: features.length,
    geometryColumn,
    geoidField,
    errorMessages: errorMessages.slice(0, 10),
    warnings: []
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
  overwrite: boolean
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
    const geoJsonStr = JSON.stringify(feature.geometry).replace(/'/g, "''")
    values.push(
      `('${geoid}', ST_Multi(ST_GeomFromGeoJSON('${geoJsonStr}')::geometry))`
    )
  }

  if (values.length === 0) {
    return { loaded: 0, errors: 0, errorMessages: [] }
  }

  const conflictAction = overwrite 
    ? `DO UPDATE SET ${geometryColumn} = EXCLUDED.${geometryColumn}`
    : `DO NOTHING`

  const insertSql = `
    INSERT INTO ${tableName} (geoid, ${geometryColumn})
    VALUES ${values.join(', ')}
    ON CONFLICT (geoid) ${conflictAction}
  `

  try {
    const { error } = await supabase.rpc('exec_sql', { query: insertSql })
    
    if (error) {
      return {
        loaded: 0,
        errors: geoids.length,
        errorMessages: [error.message.substring(0, 200)]
      }
    }

    return {
      loaded: geoids.length,
      errors: 0,
      errorMessages: []
    }
  } catch (error: any) {
    return {
      loaded: 0,
      errors: geoids.length,
      errorMessages: [error.message.substring(0, 200)]
    }
  }
}

