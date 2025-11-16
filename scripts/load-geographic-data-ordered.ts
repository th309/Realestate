/**
 * Load Geographic Data in Order with Hierarchy Building
 * 
 * Loads: National → States → Metros → Cities → Counties → Zip codes
 * After each level: Links to TIGER and builds hierarchy
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../web/.env.local') })

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials. Check your .env.local file.')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  })
}

interface LoadResult {
  level: string
  recordsLoaded: number
  recordsLinked: number
  relationshipsCreated: number
  success: boolean
  error?: string
}

async function loadNational(): Promise<LoadResult> {
  console.log('\n📦 STEP 1: Loading National...')
  const supabase = createSupabaseAdminClient()

  try {
    // Create national market record
    const { error } = await supabase
      .from('markets')
      .upsert({
        region_id: 'US',
        region_name: 'United States',
        region_type: 'national',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'region_id'
      })

    if (error) throw error

    console.log('✅ National loaded: US')
    return {
      level: 'national',
      recordsLoaded: 1,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: true
    }
  } catch (error: any) {
    console.error('❌ Error loading national:', error)
    return {
      level: 'national',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    }
  }
}

async function loadStates(): Promise<LoadResult> {
  console.log('\n📦 STEP 2: Loading States from TIGER...')
  const supabase = createSupabaseAdminClient()

  try {
    // Get all states from TIGER
    const { data: statesData, error: directError } = await supabase
      .from('tiger_states')
      .select('geoid, name, geometry')
      .order('geoid')

    if (directError) throw directError

    // Insert states into markets
    const markets = statesData?.map(state => ({
      region_id: `US-${state.geoid}`,
      region_name: state.name,
      region_type: 'state',
      state_code: state.geoid,
      state_name: state.name,
      geoid: state.geoid,
      geometry: state.geometry,
      external_ids: {
        tiger_state_geoid: state.geoid
      }
    })) || []

    if (markets.length > 0) {
      const { error: insertError } = await supabase
        .from('markets')
        .upsert(markets, {
          onConflict: 'region_id'
        })

      if (insertError) throw insertError
    }

    console.log(`✅ Loaded ${markets.length} states`)

    // Link to TIGER
    const { data: linkResult, error: linkError } = await supabase.rpc('link_markets_to_tiger')
    if (linkError) {
      console.warn('⚠️  Warning linking to TIGER:', linkError.message)
    } else {
      console.log(`✅ Linked markets to TIGER`)
    }

    // Build hierarchy (states → national)
    const { data: hierarchyResult, error: hierarchyError } = await supabase.rpc('build_markets_hierarchy_from_tiger')
    if (hierarchyError) {
      console.warn('⚠️  Warning building hierarchy:', hierarchyError.message)
    } else {
      const relationshipsCreated = hierarchyResult?.[0]?.relationships_created || hierarchyResult || 0
      console.log(`✅ Created hierarchy relationships`)
    }

    return {
      level: 'states',
      recordsLoaded: markets.length,
      recordsLinked: linkResult || 0,
      relationshipsCreated: hierarchyResult?.[0]?.relationships_created || hierarchyResult || 0,
      success: true
    }
  } catch (error: any) {
    console.error('❌ Error loading states:', error)
    return {
      level: 'states',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    }
  }
}

async function loadMetros(): Promise<LoadResult> {
  console.log('\n📦 STEP 3: Loading Metros (CBSA) from TIGER...')
  const supabase = createSupabaseAdminClient()

  try {
    // Get all CBSAs from TIGER in batches
    const batchSize = 500
    let offset = 0
    let totalLoaded = 0

    while (true) {
      const { data: cbsas, error } = await supabase
        .from('tiger_cbsa')
        .select('geoid, name, geometry, lsad')
        .range(offset, offset + batchSize - 1)
        .order('geoid')

      if (error) throw error
      if (!cbsas || cbsas.length === 0) break

      // Insert metros into markets
      const markets = cbsas.map(cbsa => ({
        region_id: `US-MSA-${cbsa.geoid}`,
        region_name: cbsa.name,
        region_type: 'msa',
        geoid: cbsa.geoid,
        geometry: cbsa.geometry,
        external_ids: {
          tiger_cbsa_geoid: cbsa.geoid,
          census_msa: cbsa.geoid
        }
      }))

      const { error: insertError } = await supabase
        .from('markets')
        .upsert(markets, {
          onConflict: 'region_id'
        })

      if (insertError) throw insertError

      totalLoaded += markets.length
      offset += batchSize

      console.log(`  Loaded ${totalLoaded} metros...`)

      if (cbsas.length < batchSize) break
    }

    console.log(`✅ Loaded ${totalLoaded} metros total`)

    // Link to TIGER
    const { data: linkResult, error: linkError } = await supabase.rpc('link_markets_to_tiger')
    if (linkError) {
      console.warn('⚠️  Warning linking to TIGER:', linkError.message)
    } else {
      console.log(`✅ Linked markets to TIGER`)
    }

    // Build hierarchy
    const { data: hierarchyResult, error: hierarchyError } = await supabase.rpc('build_markets_hierarchy_from_tiger')
    if (hierarchyError) {
      console.warn('⚠️  Warning building hierarchy:', hierarchyError.message)
    } else {
      console.log(`✅ Created hierarchy relationships`)
    }

    return {
      level: 'metros',
      recordsLoaded: totalLoaded,
      recordsLinked: linkResult || 0,
      relationshipsCreated: hierarchyResult?.[0]?.relationships_created || hierarchyResult || 0,
      success: true
    }
  } catch (error: any) {
    console.error('❌ Error loading metros:', error)
    return {
      level: 'metros',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    }
  }
}

async function loadCities(): Promise<LoadResult> {
  console.log('\n📦 STEP 4: Loading Cities (Places) from TIGER...')
  const supabase = createSupabaseAdminClient()

  try {
    // Get all places from TIGER (in batches to avoid memory issues)
    const batchSize = 1000
    let offset = 0
    let totalLoaded = 0

    while (true) {
      const { data: places, error } = await supabase
        .from('tiger_places')
        .select('geoid, name, state_fips, geometry')
        .range(offset, offset + batchSize - 1)
        .order('geoid')

      if (error) throw error
      if (!places || places.length === 0) break

      // Insert cities into markets
      const markets = places.map(place => ({
        region_id: `US-CITY-${place.geoid}`,
        region_name: place.name,
        region_type: 'city',
        state_code: place.state_fips,
        geoid: place.geoid,
        geometry: place.geometry,
        external_ids: {
          tiger_place_geoid: place.geoid
        }
      }))

      const { error: insertError } = await supabase
        .from('markets')
        .upsert(markets, {
          onConflict: 'region_id'
        })

      if (insertError) throw insertError

      totalLoaded += markets.length
      offset += batchSize

      console.log(`  Loaded ${totalLoaded} cities...`)

      if (places.length < batchSize) break
    }

    console.log(`✅ Loaded ${totalLoaded} cities total`)

    // Link to TIGER
    const { data: linkResult, error: linkError } = await supabase.rpc('link_markets_to_tiger')
    if (linkError) {
      console.warn('⚠️  Warning linking to TIGER:', linkError.message)
    } else {
      console.log(`✅ Linked markets to TIGER`)
    }

    // Build hierarchy
    const { data: hierarchyResult, error: hierarchyError } = await supabase.rpc('build_markets_hierarchy_from_tiger')
    if (hierarchyError) {
      console.warn('⚠️  Warning building hierarchy:', hierarchyError.message)
    } else {
      console.log(`✅ Created hierarchy relationships`)
    }

      return {
        level: 'cities',
        recordsLoaded: totalLoaded,
        recordsLinked: linkResult || 0,
        relationshipsCreated: hierarchyResult?.[0]?.relationships_created || hierarchyResult || 0,
        success: true
      }
  } catch (error: any) {
    console.error('❌ Error loading cities:', error)
    return {
      level: 'cities',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    }
  }
}

async function loadCounties(): Promise<LoadResult> {
  console.log('\n📦 STEP 5: Loading Counties from TIGER...')
  const supabase = createSupabaseAdminClient()

  try {
    // Get all counties from TIGER
    const { data: counties, error } = await supabase
      .from('tiger_counties')
      .select('geoid, name, state_fips, geometry')
      .order('geoid')

    if (error) throw error

    // Insert counties into markets
    const markets = counties?.map(county => ({
      region_id: `US-COUNTY-${county.geoid}`,
      region_name: county.name,
      region_type: 'county',
      state_code: county.state_fips,
      county_fips: county.geoid,
      geoid: county.geoid,
      geometry: county.geometry,
      external_ids: {
        tiger_county_geoid: county.geoid
      }
    })) || []

    if (markets.length > 0) {
      const { error: insertError } = await supabase
        .from('markets')
        .upsert(markets, {
          onConflict: 'region_id'
        })

      if (insertError) throw insertError
    }

    console.log(`✅ Loaded ${markets.length} counties`)

    // Link to TIGER
    const { data: linkResult, error: linkError } = await supabase.rpc('link_markets_to_tiger')
    if (linkError) {
      console.warn('⚠️  Warning linking to TIGER:', linkError.message)
    } else {
      console.log(`✅ Linked markets to TIGER`)
    }

    // Build hierarchy
    const { data: hierarchyResult, error: hierarchyError } = await supabase.rpc('build_markets_hierarchy_from_tiger')
    if (hierarchyError) {
      console.warn('⚠️  Warning building hierarchy:', hierarchyError.message)
    } else {
      console.log(`✅ Created hierarchy relationships`)
    }

      return {
        level: 'counties',
        recordsLoaded: markets.length,
        recordsLinked: linkResult || 0,
        relationshipsCreated: hierarchyResult?.[0]?.relationships_created || hierarchyResult || 0,
        success: true
      }
  } catch (error: any) {
    console.error('❌ Error loading counties:', error)
    return {
      level: 'counties',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    }
  }
}

async function loadZipCodes(): Promise<LoadResult> {
  console.log('\n📦 STEP 6: Loading Zip Codes (ZCTA) from TIGER...')
  const supabase = createSupabaseAdminClient()

  try {
    // Check if ZCTA data exists
    const { count, error: countError } = await supabase
      .from('tiger_zcta')
      .select('*', { count: 'exact', head: true })

    if (countError || !count || count === 0) {
      console.log('⚠️  No ZCTA data in tiger_zcta table. Skipping zip codes.')
      return {
        level: 'zipcodes',
        recordsLoaded: 0,
        recordsLinked: 0,
        relationshipsCreated: 0,
        success: true,
        error: 'No ZCTA data available'
      }
    }

    // Get all ZCTAs from TIGER (in batches)
    const batchSize = 1000
    let offset = 0
    let totalLoaded = 0

    while (true) {
      const { data: zctas, error } = await supabase
        .from('tiger_zcta')
        .select('geoid, geometry')
        .range(offset, offset + batchSize - 1)
        .order('geoid')

      if (error) throw error
      if (!zctas || zctas.length === 0) break

      // Insert zip codes into markets
      const markets = zctas.map(zcta => ({
        region_id: `US-ZIP-${zcta.geoid}`,
        region_name: `ZIP ${zcta.geoid}`,
        region_type: 'zip',
        geoid: zcta.geoid,
        geometry: zcta.geometry,
        external_ids: {
          tiger_zcta_geoid: zcta.geoid
        }
      }))

      const { error: insertError } = await supabase
        .from('markets')
        .upsert(markets, {
          onConflict: 'region_id'
        })

      if (insertError) throw insertError

      totalLoaded += markets.length
      offset += batchSize

      console.log(`  Loaded ${totalLoaded} zip codes...`)

      if (zctas.length < batchSize) break
    }

    console.log(`✅ Loaded ${totalLoaded} zip codes total`)

    // Link to TIGER
    const { data: linkResult, error: linkError } = await supabase.rpc('link_markets_to_tiger')
    if (linkError) {
      console.warn('⚠️  Warning linking to TIGER:', linkError.message)
    } else {
      console.log(`✅ Linked markets to TIGER`)
    }

    // Build hierarchy
    const { data: hierarchyResult, error: hierarchyError } = await supabase.rpc('build_markets_hierarchy_from_tiger')
    if (hierarchyError) {
      console.warn('⚠️  Warning building hierarchy:', hierarchyError.message)
    } else {
      console.log(`✅ Created hierarchy relationships`)
    }

      return {
        level: 'zipcodes',
        recordsLoaded: totalLoaded,
        recordsLinked: linkResult || 0,
        relationshipsCreated: hierarchyResult?.[0]?.relationships_created || hierarchyResult || 0,
        success: true
      }
  } catch (error: any) {
    console.error('❌ Error loading zip codes:', error)
    return {
      level: 'zipcodes',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    }
  }
}

async function main() {
  console.log('🚀 Starting Ordered Geographic Data Load')
  console.log('========================================\n')

  const results: LoadResult[] = []

  // Step 1: National
  const nationalResult = await loadNational()
  results.push(nationalResult)
  if (!nationalResult.success) {
    console.error('❌ Failed to load national. Stopping.')
    return
  }

  // Step 2: States
  const statesResult = await loadStates()
  results.push(statesResult)
  if (!statesResult.success) {
    console.error('❌ Failed to load states. Stopping.')
    return
  }

  // Step 3: Metros
  const metrosResult = await loadMetros()
  results.push(metrosResult)
  if (!metrosResult.success) {
    console.error('⚠️  Warning: Failed to load metros. Continuing...')
  }

  // Step 4: Cities
  const citiesResult = await loadCities()
  results.push(citiesResult)
  if (!citiesResult.success) {
    console.error('⚠️  Warning: Failed to load cities. Continuing...')
  }

  // Step 5: Counties
  const countiesResult = await loadCounties()
  results.push(countiesResult)
  if (!countiesResult.success) {
    console.error('⚠️  Warning: Failed to load counties. Continuing...')
  }

  // Step 6: Zip Codes
  const zipResult = await loadZipCodes()
  results.push(zipResult)
  if (!zipResult.success) {
    console.error('⚠️  Warning: Failed to load zip codes.')
  }

  // Final summary
  console.log('\n========================================')
  console.log('📊 LOAD SUMMARY')
  console.log('========================================')
  
  let totalLoaded = 0
  let totalRelationships = 0

  results.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.level.padEnd(12)}: ${result.recordsLoaded.toString().padStart(6)} records, ${result.relationshipsCreated.toString().padStart(6)} relationships`)
    totalLoaded += result.recordsLoaded
    totalRelationships += result.relationshipsCreated
  })

  console.log('----------------------------------------')
  console.log(`TOTAL: ${totalLoaded.toString().padStart(6)} records, ${totalRelationships.toString().padStart(6)} relationships`)
  console.log('========================================\n')

  // Final hierarchy build to catch any missed relationships
  console.log('🔗 Running final hierarchy build...')
  const supabase = createSupabaseAdminClient()
  const { data: finalResult, error: finalError } = await supabase.rpc('build_markets_hierarchy_complete')
  if (finalError) {
    console.warn('⚠️  Warning in final hierarchy build:', finalError.message)
  } else {
    console.log('✅ Final hierarchy build complete\n')
  }
}

main().catch(console.error)

