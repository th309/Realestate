import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { executeSQL } from '@/lib/database/migrations'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Load CBSA geometries directly using PostGIS functions
 * POST /api/load-cbsa-geometries-direct
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const projectRoot = path.resolve(process.cwd(), '..')
    const geojsonPath = path.join(projectRoot, 'scripts', 'geojson', 'tl_2024_us_cbsa.geojson')
    
    if (!fs.existsSync(geojsonPath)) {
      return NextResponse.json(
        { success: false, error: `GeoJSON file not found: ${geojsonPath}` },
        { status: 404 }
      )
    }
    
    console.log(`Reading GeoJSON: ${geojsonPath}`)
    const fileContent = fs.readFileSync(geojsonPath, 'utf-8')
    const geojson = JSON.parse(fileContent)
    const features = geojson.features || []
    
    console.log(`Processing ${features.length} features...`)
    
    // Process all features
    const featuresToProcess = features
    
    // First, check what columns exist in dim_geography_geometry
    const { data: sample, error: sampleError } = await supabase
      .from('dim_geography_geometry')
      .select('*')
      .limit(1)
    
    let geometryColumn = 'geom'
    if (!sampleError && sample && sample.length > 0) {
      const cols = Object.keys(sample[0])
      const geomCols = cols.filter(c => c !== 'geoid')
      if (geomCols.length > 0) {
        geometryColumn = geomCols[0]
      }
    }
    
    console.log(`Using geometry column: ${geometryColumn}`)
    
    let loaded = 0
    let errors = 0
    const errorMessages: string[] = []
    const batchSize = 5 // Smaller batches to avoid SQL size limits
    
    for (let i = 0; i < featuresToProcess.length; i += batchSize) {
      const batch = featuresToProcess.slice(i, i + batchSize)
      const geoids: string[] = []
      const values: string[] = []
      
      for (const feature of batch) {
        const geoid = feature.properties?.GEOID || feature.properties?.CBSAFP
        if (!geoid || !feature.geometry) continue
        
        geoids.push(geoid)
        const geoJsonStr = JSON.stringify(feature.geometry).replace(/'/g, "''")
        values.push(`('${geoid}', ST_Multi(ST_GeomFromGeoJSON('${geoJsonStr}')), ST_Multi(ST_GeomFromGeoJSON('${geoJsonStr}')), 'tiger_2024', '2024')`)
      }
      
      if (geoids.length === 0) continue
      
      try {
        // Insert batch with ON CONFLICT (unique constraint exists)
        const insertSql = `
          INSERT INTO dim_geography_geometry (geoid, ${geometryColumn}, geom_full, source, vintage)
          VALUES ${values.join(', ')}
          ON CONFLICT (geoid) 
          DO UPDATE SET 
            ${geometryColumn} = EXCLUDED.${geometryColumn},
            geom_full = EXCLUDED.geom_full,
            source = EXCLUDED.source,
            vintage = EXCLUDED.vintage
        `
        
        const { error: sqlError } = await supabase.rpc('exec_sql', { query: insertSql })
        
        if (!sqlError) {
          loaded += geoids.length
        } else {
          errors += geoids.length
          const errorMsg = `Batch ${Math.floor(i/batchSize) + 1}: ${sqlError.message.substring(0, 200)}`
          if (errorMessages.length < 10) {
            errorMessages.push(errorMsg)
          }
        }
      } catch (error: any) {
        errors += geoids.length
        const errorMsg = `Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`
        if (errorMessages.length < 10) {
          errorMessages.push(errorMsg)
        }
      }
      
      if ((i + batchSize) % 100 === 0) {
        console.log(`Processed ${Math.min(i + batchSize, featuresToProcess.length)}/${featuresToProcess.length}... (Loaded: ${loaded}, Errors: ${errors})`)
      }
    }
    
    // Verify
    const { count: geomCount } = await supabase
      .from('dim_geography_geometry')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      success: errors === 0,
      loaded,
      errors,
      totalFeatures: features.length,
      processed: featuresToProcess.length,
      geometryColumn,
      totalGeometries: geomCount || 0,
      errorMessages: errorMessages.slice(0, 10)
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

