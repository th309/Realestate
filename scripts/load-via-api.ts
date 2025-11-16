#!/usr/bin/env node
/**
 * Load geographic data via the API endpoint
 * This uses the web API which has access to service role key
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

const API_URL = process.env.API_URL || 'http://localhost:3000'
const SUPABASE_URL = `https://pysflbhpnqwoczyuaaif.supabase.co`
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTM3MzUsImV4cCI6MjA3ODE4OTczNX0.txaMHdCFyL_X1fi3-_gzcaMENjxGFHASGsBS_RnCLWc'

async function loadFileViaAPI(
  filePath: string,
  tableName: string,
  fileType: 'shapefile' | 'geojson' = 'geojson',
  geometryColumn: string = 'geometry',
  geoidField: string = 'GEOID'
) {
  const fileName = path.basename(filePath)
  const fileExt = path.extname(fileName).toLowerCase()
  
  console.log(`\n📂 Loading: ${fileName}`)
  console.log(`   Table: ${tableName}`)
  console.log(`   Type: ${fileType}`)
  
  // Read file
  const fileBuffer = await fs.promises.readFile(filePath)
  const file = new File([fileBuffer], fileName, { type: fileType === 'geojson' ? 'application/json' : 'application/zip' })
  
  // Create form data
  const formData = new FormData()
  formData.append('file', file)
  formData.append('fileType', fileType)
  formData.append('tableName', tableName)
  formData.append('geometryColumn', geometryColumn)
  formData.append('geoidField', geoidField)
  formData.append('batchSize', '10')
  formData.append('overwrite', 'false')
  
  try {
    const response = await fetch(`${API_URL}/api/admin/upload-geographic-data`, {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API error: ${response.status} - ${error}`)
    }
    
    const result = await response.json()
    
    if (result.success) {
      console.log(`   ✅ Successfully loaded ${result.loaded} features`)
    } else {
      console.log(`   ⚠️  Loaded ${result.loaded} features with ${result.errors} errors`)
      if (result.errorMessages && result.errorMessages.length > 0) {
        console.log(`   Errors: ${result.errorMessages.slice(0, 3).join(', ')}`)
      }
    }
    
    return result
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`)
    throw error
  }
}

async function main() {
  console.log('========================================')
  console.log('  Load Geographic Data via API')
  console.log('========================================\n')
  
  // Check if API is available
  try {
    const healthCheck = await fetch(`${API_URL}/api/health`)
    if (!healthCheck.ok) {
      throw new Error('API not available')
    }
  } catch (error) {
    console.error(`❌ API not available at ${API_URL}`)
    console.error('   Please start the web server: cd web && npm run dev')
    process.exit(1)
  }
  
  const scriptDir = path.join(__dirname, '..')
  const geojsonDir = path.join(scriptDir, 'scripts', 'geojson')
  
  // Load main national files
  const mainFiles = [
    { file: 'tl_2024_us_state.geojson', table: 'tiger_states', geoid: 'GEOID' },
    { file: 'tl_2024_us_county.geojson', table: 'tiger_counties', geoid: 'GEOID' },
    { file: 'tl_2024_us_cbsa.geojson', table: 'tiger_cbsa', geoid: 'GEOID' },
    { file: 'tl_2024_us_zcta520.geojson', table: 'tiger_zcta', geoid: 'GEOID20' },
  ]
  
  console.log('Loading main national files...\n')
  
  for (const { file, table, geoid } of mainFiles) {
    const filePath = path.join(geojsonDir, file)
    if (fs.existsSync(filePath)) {
      await loadFileViaAPI(filePath, table, 'geojson', 'geometry', geoid)
    } else {
      console.log(`⚠️  File not found: ${file}`)
    }
  }
  
  console.log('\n✅ Main files loaded!')
  console.log('\nNote: To load place files, run this script again with place files specified.')
}

if (require.main === module) {
  main().catch(console.error)
}

