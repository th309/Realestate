/**
 * Geographic Code Mapping Utilities
 * Maps Zillow region names to our geo_code format
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * Map Zillow region name to geo_code
 * Tries to match against existing geo_data table
 */
export async function mapZillowRegionToGeoCode(
  regionName: string,
  stateCode: string,
  geoType: 'metro' | 'state' | 'city' | 'zipcode' = 'metro'
): Promise<string | null> {
  console.log('[geo-mapping] mapZillowRegionToGeoCode called with:', { regionName, stateCode, geoType })
  
  const supabase = createSupabaseAdminClient()
  console.log('[geo-mapping] Supabase client created')

  // Clean region name for matching
  const cleanName = regionName
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Try exact match first
  console.log('[geo-mapping] Trying exact match for:', { cleanName, stateCode, geoType })
  const { data: exactMatch, error: exactError } = await supabase
    .from('geo_data')
    .select('geo_code')
    .eq('geo_name', cleanName)
    .eq('state_code', stateCode)
    .eq('geo_type', geoType)
    .limit(1)
    .single()

  if (exactError && exactError.code !== 'PGRST116') {
    console.error('[geo-mapping] Exact match query error:', exactError)
  }

  if (exactMatch) {
    console.log('[geo-mapping] Found exact match:', exactMatch.geo_code)
    return exactMatch.geo_code
  }

  // Try partial match (contains)
  const { data: partialMatch } = await supabase
    .from('geo_data')
    .select('geo_code')
    .ilike('geo_name', `%${cleanName}%`)
    .eq('state_code', stateCode)
    .eq('geo_type', geoType)
    .limit(1)
    .single()

  if (partialMatch) {
    return partialMatch.geo_code
  }

  // Try reverse - check if our name contains their name
  const { data: reverseMatch } = await supabase
    .from('geo_data')
    .select('geo_code, geo_name')
    .eq('state_code', stateCode)
    .eq('geo_type', geoType)
    .limit(100)

  if (reverseMatch) {
    for (const geo of reverseMatch) {
      if (geo.geo_name && cleanName.includes(geo.geo_name)) {
        return geo.geo_code
      }
      if (geo.geo_name && geo.geo_name.includes(cleanName)) {
        return geo.geo_code
      }
    }
  }

  // No match found
  console.warn(`⚠️ [geo-mapping] No geo_code found for: ${cleanName}, ${stateCode}, ${geoType}`)
  return null
}

/**
 * Alias for backwards compatibility
 */
export const mapRegionToGeoCode = mapZillowRegionToGeoCode

/**
 * Generate a temporary geo_code for unmapped regions
 * Format: US-MSA-{sanitized-name}-{state}
 */
export function generateTempGeoCode(
  regionName: string,
  stateCode: string,
  geoType: string = 'metro'
): string {
  const sanitized = regionName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 15)

  const prefix = geoType === 'metro' ? 'MSA' : geoType.toUpperCase()
  return `US-${prefix}-${sanitized}-${stateCode}`.substring(0, 20)
}

