/**
 * Load CBSA (Metropolitan Statistical Area) geography from TIGER 2024 GeoJSON
 * into dim_geography and dim_geography_geometry tables
 * 
 * Usage: npx tsx scripts/load-cbsa-geography.ts
 */

import { createSupabaseAdminClient } from '../web/lib/supabase/admin'
import * as fs from 'fs'
import * as path from 'path'

interface GeoJSONFeature {
  type: string
  properties: {
    GEOID: string
    NAME: string
    NAMELSAD?: string
    LSAD?: string
    CBSAFP?: string
    MEMI?: string
    MTFCC?: string
    ALAND?: number
    AWATER?: number
  }
  geometry: any
}

interface GeoJSON {
  type: string
  features: GeoJSONFeature[]
}

async function loadCBSAGeography() {
  console.log('🚀 Loading CBSA geography from TIGER 2024...\n')
  
  const supabase = createSupabaseAdminClient()
  const geojsonPath = path.join(__dirname, 'shapefiles', 'tl_2024_us_cbsa.geojson')
  
  // Check if file exists
  if (!fs.existsSync(geojsonPath)) {
    console.error(`❌ GeoJSON file not found: ${geojsonPath}`)
    console.error('   Please ensure tl_2024_us_cbsa.geojson exists in scripts/shapefiles/')
    process.exit(1)
  }
  
  console.log(`📂 Reading GeoJSON file: ${geojsonPath}`)
  const fileContent = fs.readFileSync(geojsonPath, 'utf-8')
  const geojson: GeoJSON = JSON.parse(fileContent)
  
  console.log(`📊 Found ${geojson.features.length} CBSA features\n`)
  
  let loaded = 0
  let skipped = 0
  let errors = 0
  
  // Process in batches to avoid overwhelming the database
  const batchSize = 50
  const batches = []
  
  for (let i = 0; i < geojson.features.length; i += batchSize) {
    batches.push(geojson.features.slice(i, i + batchSize))
  }
  
  console.log(`📦 Processing ${batches.length} batches of up to ${batchSize} features each...\n`)
  
  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]
    console.log(`Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} features)...`)
    
    const geographyRecords: any[] = []
    const geometryRecords: any[] = []
    
    for (const feature of batch) {
      try {
        const geoid = feature.properties.GEOID || feature.properties.CBSAFP
        const name = feature.properties.NAMELSAD || feature.properties.NAME
        
        if (!geoid || !name) {
          console.warn(`⚠️  Skipping feature with missing GEOID or NAME`)
          skipped++
          continue
        }
        
        // Create geography record
        geographyRecords.push({
          geoid: geoid,
          name: name,
          level: 'cbsa'
        })
        
        // Create geometry record
        // Convert GeoJSON geometry to PostGIS format (WKT or GeoJSON)
        geometryRecords.push({
          geoid: geoid,
          geometry: feature.geometry // PostGIS accepts GeoJSON geometry directly
        })
        
      } catch (error: any) {
        console.error(`❌ Error processing feature: ${error.message}`)
        errors++
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
        console.error(`❌ Error inserting geography records: ${geoError.message}`)
        errors += geographyRecords.length
      } else {
        loaded += geographyRecords.length
        console.log(`  ✅ Loaded ${geographyRecords.length} geography records`)
      }
    }
    
    // Insert geometry records
    if (geometryRecords.length > 0) {
      // Note: PostGIS geometry insertion may require special handling
      // If direct GeoJSON doesn't work, we may need to use ST_GeomFromGeoJSON
      const { error: geomError } = await supabase
        .from('dim_geography_geometry')
        .upsert(geometryRecords, {
          onConflict: 'geoid',
          ignoreDuplicates: false
        })
      
      if (geomError) {
        console.error(`❌ Error inserting geometry records: ${geomError.message}`)
        console.error(`   This might require using ST_GeomFromGeoJSON SQL function`)
        // Try alternative approach using raw SQL
        for (const record of geometryRecords) {
          const { error: sqlError } = await supabase.rpc('exec_sql', {
            query: `
              INSERT INTO dim_geography_geometry (geoid, geometry)
              VALUES ('${record.geoid}', ST_GeomFromGeoJSON('${JSON.stringify(record.geometry)}'))
              ON CONFLICT (geoid) DO UPDATE SET geometry = ST_GeomFromGeoJSON('${JSON.stringify(record.geometry)}')
            `
          })
          
          if (sqlError) {
            console.error(`  ❌ Failed to insert geometry for ${record.geoid}: ${sqlError.message}`)
            errors++
          }
        }
      } else {
        console.log(`  ✅ Loaded ${geometryRecords.length} geometry records`)
      }
    }
  }
  
  console.log(`\n📊 Summary:`)
  console.log(`   ✅ Loaded: ${loaded}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log(`\n✅ CBSA geography loading complete!`)
  
  // Verify the load
  console.log(`\n🔍 Verifying load...`)
  const { count: cbsaCount } = await supabase
    .from('dim_geography')
    .select('*', { count: 'exact', head: true })
    .eq('level', 'cbsa')
  
  const { count: geomCount } = await supabase
    .from('dim_geography_geometry')
    .select('*', { count: 'exact', head: true })
  
  console.log(`   CBSA entries in dim_geography: ${cbsaCount || 0}`)
  console.log(`   Total geometries in dim_geography_geometry: ${geomCount || 0}`)
}

loadCBSAGeography().catch(console.error)

