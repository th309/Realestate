import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Load CBSA geography from TIGER 2024 GeoJSON
 * POST /api/load-cbsa-geography
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    // Path resolution: process.cwd() in Next.js API routes is the project root (web/)
    // We need to go up one level to get to the project root, then into scripts/geojson
    const projectRoot = path.resolve(process.cwd(), '..')
    const geojsonPath = path.join(projectRoot, 'scripts', 'geojson', 'tl_2024_us_cbsa.geojson')
    
    // Check if file exists
    if (!fs.existsSync(geojsonPath)) {
      return NextResponse.json(
        {
          success: false,
          error: `GeoJSON file not found: ${geojsonPath}`
        },
        { status: 404 }
      )
    }
    
    console.log(`Reading GeoJSON file: ${geojsonPath}`)
    const fileContent = fs.readFileSync(geojsonPath, 'utf-8')
    const geojson = JSON.parse(fileContent)
    
    const features = geojson.features || []
    console.log(`Found ${features.length} CBSA features`)
    
    let loaded = 0
    let skipped = 0
    let errors = 0
    const errorMessages: string[] = []
    
    // Process in batches
    const batchSize = 50
    const batches = []
    
    for (let i = 0; i < features.length; i += batchSize) {
      batches.push(features.slice(i, i + batchSize))
    }
    
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx]
      
      const geographyRecords: any[] = []
      
      for (const feature of batch) {
        try {
          const geoid = feature.properties?.GEOID || feature.properties?.CBSAFP
          const name = feature.properties?.NAMELSAD || feature.properties?.NAME
          
          if (!geoid || !name) {
            skipped++
            continue
          }
          
          geographyRecords.push({
            geoid: geoid,
            name: name,
            level: 'cbsa'
          })
        } catch (error: any) {
          errors++
          errorMessages.push(`Feature error: ${error.message}`)
        }
      }
      
      // Insert geography records
      if (geographyRecords.length > 0) {
        const { error: geoError } = await supabase
          .from('dim_geography')
          .upsert(geographyRecords, {
            onConflict: 'geoid',
            ignoreDuplicates: false
          })
        
        if (geoError) {
          errors += geographyRecords.length
          errorMessages.push(`Geography insert error: ${geoError.message}`)
        } else {
          loaded += geographyRecords.length
        }
      }
      
      // Insert geometries using SQL (PostGIS requires ST_GeomFromGeoJSON)
      // First, determine the correct column name by checking the table structure
      let geometryColumnName: string | null = null
      if (batchIdx === 0) {
        // On first batch, try to determine column name
        const { data: testData, error: testError } = await supabase
          .from('dim_geography_geometry')
          .select('*')
          .limit(1)
        
        if (!testError && testData && testData.length > 0) {
          // Check which column contains geometry data
          const row = testData[0]
          for (const [key, value] of Object.entries(row)) {
            if (key !== 'geoid' && value !== null) {
              // Likely the geometry column
              geometryColumnName = key
              break
            }
          }
        }
        
        // If still not found, try querying information_schema
        if (!geometryColumnName) {
          const { data: schemaData, error: schemaError } = await supabase.rpc('exec_sql', {
            query: `
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = 'dim_geography_geometry' 
              AND table_schema = 'public'
              AND column_name != 'geoid'
              ORDER BY ordinal_position
              LIMIT 1
            `
          })
          
          if (!schemaError && schemaData && schemaData.length > 0) {
            geometryColumnName = schemaData[0].column_name
          }
        }
        
        // Default to common names if still not found
        if (!geometryColumnName) {
          geometryColumnName = 'geom' // Most common PostGIS convention
        }
        
        console.log(`Using geometry column: ${geometryColumnName}`)
      }
      
      for (const feature of batch) {
        try {
          const geoid = feature.properties?.GEOID || feature.properties?.CBSAFP
          if (!geoid || !feature.geometry) continue
          
          // Use RPC to execute SQL with PostGIS function
          const geoJsonStr = JSON.stringify(feature.geometry).replace(/'/g, "''")
          const colName = geometryColumnName || 'geom'
          
          const { error: sqlError } = await supabase.rpc('exec_sql', {
            query: `
              INSERT INTO dim_geography_geometry (geoid, ${colName})
              VALUES ('${geoid}', ST_GeomFromGeoJSON('${geoJsonStr}'))
              ON CONFLICT (geoid) 
              DO UPDATE SET ${colName} = ST_GeomFromGeoJSON('${geoJsonStr}')
            `
          })
          
          if (sqlError) {
            // If column doesn't exist, try other common names
            if (sqlError.message.includes('does not exist') && batchIdx === 0) {
              // Try alternative column names
              for (const altCol of ['geometry', 'the_geom', 'shape']) {
                const { error: altError } = await supabase.rpc('exec_sql', {
                  query: `
                    INSERT INTO dim_geography_geometry (geoid, ${altCol})
                    VALUES ('${geoid}', ST_GeomFromGeoJSON('${geoJsonStr}'))
                    ON CONFLICT (geoid) 
                    DO UPDATE SET ${altCol} = ST_GeomFromGeoJSON('${geoJsonStr}')
                  `
                })
                
                if (!altError) {
                  geometryColumnName = altCol
                  break
                }
              }
            } else {
              errors++
              if (errorMessages.length < 5) {
                errorMessages.push(`Geometry insert error for ${geoid}: ${sqlError.message}`)
              }
            }
          }
        } catch (error: any) {
          errors++
          if (errorMessages.length < 5) {
            errorMessages.push(`Geometry processing error: ${error.message}`)
          }
        }
      }
    }
    
    // Verify the load
    const { count: cbsaCount } = await supabase
      .from('dim_geography')
      .select('*', { count: 'exact', head: true })
      .eq('level', 'cbsa')
    
    return NextResponse.json({
      success: errors === 0,
      summary: {
        totalFeatures: features.length,
        loaded,
        skipped,
        errors
      },
      verification: {
        cbsaCount: cbsaCount || 0
      },
      errorMessages: errorMessages.slice(0, 10) // First 10 errors
    })
  } catch (error: any) {
    console.error('Error loading CBSA geography:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

