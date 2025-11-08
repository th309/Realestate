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
  const supabase = createSupabaseAdminClient()

  // Clean region name for matching
  const cleanName = regionName
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Try exact match first
  const { data: exactMatch } = await supabase
    .from('geo_data')
    .select('geo_code')
    .eq('geo_name', cleanName)
    .eq('state_code', stateCode)
    .eq('geo_type', geoType)
    .limit(1)
    .single()

  if (exactMatch) {
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
    .select('geo_code')
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
  console.warn(`⚠️ No geo_code found for: ${cleanName}, ${stateCode}`)
  return null
}

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

