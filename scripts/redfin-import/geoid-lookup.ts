/**
 * Geoid lookup and creation utilities
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Generate fallback geoid when lookup fails
 */
function generateFallbackGeoid(regionType: string, regionName: string): string {
  const sanitized = regionName
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toUpperCase()
    .substring(0, 30)
  return `REDFIN-${regionType.toUpperCase()}-${sanitized}`
}

/**
 * Lookup county geoid from tiger_counties
 */
async function lookupCountyGeoid(
  supabase: SupabaseClient,
  regionName: string,
  stateCode: string,
  retries: number = 2
): Promise<string | null> {
  // Clean county name
  let cleanName = regionName.replace(/,?\s*[A-Z]{2}$/, '')
  cleanName = cleanName.replace(/\s+County$/i, '').trim()

  // Get state FIPS
  const { data: stateData, error: stateError } = await supabase
    .from('tiger_states')
    .select('geoid, name, state_abbreviation')
    .eq('state_abbreviation', stateCode.toUpperCase())
    .maybeSingle()

  if (stateError || !stateData?.geoid) {
    return null
  }

  // Try exact match with retry
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data: exactCounty, error } = await supabase
        .from('tiger_counties')
        .select('geoid, name, state_fips')
        .eq('state_fips', stateData.geoid)
        .ilike('name', cleanName)
        .limit(1)
        .maybeSingle()

      if (!error && exactCounty?.geoid) {
        return exactCounty.geoid
      }

      if (error?.message?.includes('fetch') && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        continue
      }
      break
    } catch (e: any) {
      if (attempt < retries - 1 && e.message?.includes('fetch')) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        continue
      }
      break
    }
  }

  // Try partial match
  const { data: partialCounty } = await supabase
    .from('tiger_counties')
    .select('geoid, name, state_fips')
    .eq('state_fips', stateData.geoid)
    .ilike('name', `%${cleanName}%`)
    .limit(1)
    .maybeSingle()

  return partialCounty?.geoid || null
}

/**
 * Lookup state geoid from tiger_states
 */
async function lookupStateGeoid(
  supabase: SupabaseClient,
  regionName: string,
  stateCode?: string
): Promise<string | null> {
  let query = supabase
    .from('tiger_states')
    .select('geoid, name, state_abbreviation')

  if (stateCode) {
    query = query.eq('state_abbreviation', stateCode.toUpperCase())
  } else {
    const cleanName = regionName.replace(/,?\s*[A-Z]{2}$/, '').trim()
    query = query.ilike('name', `%${cleanName}%`)
  }

  const { data } = await query.limit(1).maybeSingle()
  return data?.geoid || null
}

/**
 * Lookup metro/MSA geoid from tiger_cbsa
 */
async function lookupMetroGeoid(
  supabase: SupabaseClient,
  regionName: string
): Promise<string | null> {
  const cleanName = regionName.replace(/,?\s*[A-Z]{2}(-[A-Z]{2})?$/, '').trim()

  // Try exact match
  const { data: exactCbsa } = await supabase
    .from('tiger_cbsa')
    .select('geoid, name')
    .ilike('name', cleanName)
    .limit(1)
    .maybeSingle()

  if (exactCbsa?.geoid) {
    return exactCbsa.geoid
  }

  // Try partial match
  const { data: partialCbsa } = await supabase
    .from('tiger_cbsa')
    .select('geoid, name')
    .ilike('name', `%${cleanName}%`)
    .limit(1)
    .maybeSingle()

  return partialCbsa?.geoid || null
}

/**
 * Lookup ZIP geoid from tiger_zcta
 */
async function lookupZipGeoid(
  supabase: SupabaseClient,
  regionName: string
): Promise<string | null> {
  const zipMatch = regionName.match(/\b(\d{5})\b/)
  if (!zipMatch) return null

  const { data } = await supabase
    .from('tiger_zcta')
    .select('geoid')
    .eq('geoid', zipMatch[1])
    .maybeSingle()

  return data?.geoid || null
}

/**
 * Lookup geoid from markets table as fallback
 */
async function lookupMarketsGeoid(
  supabase: SupabaseClient,
  regionName: string,
  regionType: string,
  stateCode?: string
): Promise<string | null> {
  let query = supabase
    .from('markets')
    .select('region_id')
    .eq('region_type', regionType)
    .ilike('region_name', `%${regionName}%`)

  if (stateCode) {
    query = query.eq('state_code', stateCode)
  }

  const { data } = await query.limit(1).maybeSingle()

  if (data?.region_id) {
    // Check if market has geoid
    const { data: marketData } = await supabase
      .from('markets')
      .select('external_ids, geoid')
      .eq('region_id', data.region_id)
      .maybeSingle()

    return marketData?.geoid || data.region_id
  }

  return null
}

/**
 * Get or create geoid for a region
 */
export async function getOrCreateGeoid(
  supabase: SupabaseClient,
  regionName: string,
  regionType: string,
  stateCode?: string,
  city?: string,
  retries: number = 2
): Promise<string> {
  const normalizedType = regionType.toLowerCase()

  try {
    // Try normalization tables first
    if (normalizedType === 'county' && stateCode) {
      const geoid = await lookupCountyGeoid(supabase, regionName, stateCode, retries)
      if (geoid) return geoid
    } else if (normalizedType === 'state') {
      const geoid = await lookupStateGeoid(supabase, regionName, stateCode)
      if (geoid) return geoid
    } else if (normalizedType === 'metro' || normalizedType === 'msa') {
      const geoid = await lookupMetroGeoid(supabase, regionName)
      if (geoid) return geoid
    } else if (normalizedType === 'zip' || normalizedType === 'zipcode') {
      const geoid = await lookupZipGeoid(supabase, regionName)
      if (geoid) return geoid
    }

    // Fallback to markets table
    const marketsGeoid = await lookupMarketsGeoid(supabase, regionName, regionType, stateCode)
    if (marketsGeoid) return marketsGeoid

  } catch (error: any) {
    // On error, use fallback
  }

  // Generate fallback geoid
  return generateFallbackGeoid(normalizedType, regionName)
}
