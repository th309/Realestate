/**
 * Census Geography to Region ID Mapping
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * State FIPS code to state abbreviation mapping
 */
const STATE_FIPS_TO_CODE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY'
}

/**
 * Convert FIPS code to state abbreviation
 */
export function getStateCodeFromFIPS(fipsCode: string): string | null {
  const fips = fipsCode.padStart(2, '0')
  return STATE_FIPS_TO_CODE[fips] || null
}

/**
 * Map Census geography to existing market region ID
 */
export async function mapCensusGeoToRegionId(
  name: string,
  geoCode: string,
  geoLevel: string,
  record: Record<string, string>
): Promise<string | null> {
  const supabase = createSupabaseAdminClient()

  if (geoLevel === 'state') {
    const stateCode = geoCode.padStart(2, '0')
    const stateName = name.replace(' State', '').trim()

    const { data } = await supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'state')
      .or(`region_name.ilike.%${stateName}%,state_code.eq.${stateCode}`)
      .limit(1)
      .single()

    return data?.region_id || null
  }

  if (geoLevel === 'metropolitan statistical area/micropolitan statistical area') {
    const metroName = name.split(',')[0].trim()
    const stateCode = record['state'] ? record['state'].padStart(2, '0') : null

    const query = supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'msa')
      .ilike('region_name', `%${metroName}%`)

    if (stateCode) {
      query.eq('state_code', stateCode)
    }

    const { data } = await query.limit(1).single()

    return data?.region_id || null
  }

  if (geoLevel === 'place') {
    const cityName = name.split(',')[0].trim()
    const stateCode = record['state'] ? record['state'].padStart(2, '0') : null

    const query = supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'city')
      .ilike('region_name', `%${cityName}%`)

    if (stateCode) {
      query.eq('state_code', stateCode)
    }

    const { data } = await query.limit(1).single()

    return data?.region_id || null
  }

  if (geoLevel === 'zip code tabulation area') {
    const zipCode = geoCode.padStart(5, '0')

    const { data } = await supabase
      .from('markets')
      .select('region_id')
      .eq('region_type', 'zip')
      .ilike('region_name', `%${zipCode}%`)
      .limit(1)
      .single()

    return data?.region_id || null
  }

  return null
}

/**
 * Create a new market record from Census geography
 */
export async function createMarketFromCensusGeo(
  name: string,
  geoCode: string,
  geoLevel: string,
  record: Record<string, string>
): Promise<string | null> {
  const supabase = createSupabaseAdminClient()

  if (geoLevel === 'metropolitan statistical area/micropolitan statistical area') {
    const metroName = name.split(',')[0].trim()
    const stateParts = name.split(',')
    const stateName = stateParts.length > 1 ? stateParts[1].trim() : null
    const stateCode = record['state'] ? getStateCodeFromFIPS(record['state']) : null

    const regionId = `CENSUS-MSA-${geoCode.padStart(5, '0')}`

    const marketData = {
      region_id: regionId,
      region_name: name,
      region_type: 'msa',
      state_name: stateName || undefined,
      state_code: stateCode || undefined,
      metro_name: metroName
    }

    const { error } = await supabase
      .from('markets')
      .upsert(marketData, {
        onConflict: 'region_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`❌ Error creating market for ${name}:`, error.message)
      return null
    }

    console.log(`✅ Created market: ${name} (${regionId})`)
    return regionId
  }

  if (geoLevel === 'state') {
    const stateCode = getStateCodeFromFIPS(geoCode)
    const stateName = name.replace(' State', '').trim()
    const regionId = `CENSUS-STATE-${geoCode.padStart(2, '0')}`

    const marketData = {
      region_id: regionId,
      region_name: stateName,
      region_type: 'state',
      state_name: stateName,
      state_code: stateCode
    }

    const { error } = await supabase
      .from('markets')
      .upsert(marketData, {
        onConflict: 'region_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`❌ Error creating market for ${name}:`, error.message)
      return null
    }

    return regionId
  }

  if (geoLevel === 'place') {
    const stateName = name.split(',')[1]?.trim() || null
    const stateCode = record['state'] ? getStateCodeFromFIPS(record['state']) : null
    const regionId = `CENSUS-PLACE-${geoCode.padStart(7, '0')}`

    const marketData = {
      region_id: regionId,
      region_name: name,
      region_type: 'city',
      state_name: stateName || undefined,
      state_code: stateCode || undefined
    }

    const { error } = await supabase
      .from('markets')
      .upsert(marketData, {
        onConflict: 'region_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`❌ Error creating market for ${name}:`, error.message)
      return null
    }

    return regionId
  }

  if (geoLevel === 'zip code tabulation area') {
    const zipCode = geoCode.padStart(5, '0')
    const regionId = `CENSUS-ZIP-${zipCode}`

    const marketData = {
      region_id: regionId,
      region_name: `ZIP Code ${zipCode}`,
      region_type: 'zip',
      state_code: record['state'] ? getStateCodeFromFIPS(record['state']) : undefined
    }

    const { error } = await supabase
      .from('markets')
      .upsert(marketData, {
        onConflict: 'region_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`❌ Error creating market for ZIP ${zipCode}:`, error.message)
      return null
    }

    return regionId
  }

  return null
}
