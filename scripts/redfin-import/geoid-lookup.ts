/**
 * Geoid lookup and creation utilities
 *
 * Pre-loads all reference tables into memory at startup to eliminate
 * per-row DB roundtrips during streaming import.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// In-memory caches populated by preloadGeoidCache()
let statesByAbbr: Map<string, { geoid: string; name: string }> = new Map()
let statesByNameLower: Map<string, { geoid: string; abbreviation: string }> = new Map()
let countiesByStateFipsAndName: Map<string, string> = new Map() // key: `${state_fips}|${name_lower}` → geoid
let countiesByStateFipsPartial: Map<string, Array<{ name: string; geoid: string }>> = new Map() // key: state_fips → entries
let cbsaByNameLower: Map<string, string> = new Map()
let cbsaByNamePartial: Array<{ name: string; geoid: string }> = []
let zctaGeoids: Set<string> = new Set()
let cacheLoaded = false

/**
 * Pre-load all reference tables into memory.
 * Call once before starting the streaming import.
 * This replaces thousands of individual DB queries with ~4 bulk fetches.
 */
export async function preloadGeoidCache(supabase: SupabaseClient): Promise<void> {
  if (cacheLoaded) return

  console.log('  Loading geoid reference tables into memory...')
  const start = Date.now()

  // Load states
  const { data: states } = await supabase
    .from('tiger_states')
    .select('geoid, name, state_abbreviation')
    .limit(100)

  if (states) {
    for (const s of states) {
      if (s.state_abbreviation) {
        statesByAbbr.set(s.state_abbreviation.toUpperCase(), { geoid: s.geoid, name: s.name })
      }
      if (s.name) {
        statesByNameLower.set(s.name.toLowerCase(), { geoid: s.geoid, abbreviation: s.state_abbreviation })
      }
    }
    console.log(`    States: ${states.length} loaded`)
  }

  // Load counties (paginated - there are ~3200)
  let countyCount = 0
  let offset = 0
  const pageSize = 1000
  while (true) {
    const { data: counties } = await supabase
      .from('tiger_counties')
      .select('geoid, name, state_fips')
      .range(offset, offset + pageSize - 1)

    if (!counties || counties.length === 0) break

    for (const c of counties) {
      const key = `${c.state_fips}|${c.name.toLowerCase()}`
      countiesByStateFipsAndName.set(key, c.geoid)

      // Also build partial-match index
      if (!countiesByStateFipsPartial.has(c.state_fips)) {
        countiesByStateFipsPartial.set(c.state_fips, [])
      }
      countiesByStateFipsPartial.get(c.state_fips)!.push({ name: c.name.toLowerCase(), geoid: c.geoid })
    }
    countyCount += counties.length
    offset += pageSize
    if (counties.length < pageSize) break
  }
  console.log(`    Counties: ${countyCount} loaded`)

  // Load CBSAs (paginated)
  let cbsaCount = 0
  offset = 0
  while (true) {
    const { data: cbsas } = await supabase
      .from('tiger_cbsa')
      .select('geoid, name')
      .range(offset, offset + pageSize - 1)

    if (!cbsas || cbsas.length === 0) break

    for (const c of cbsas) {
      const nameLower = c.name.toLowerCase()
      cbsaByNameLower.set(nameLower, c.geoid)
      cbsaByNamePartial.push({ name: nameLower, geoid: c.geoid })
    }
    cbsaCount += cbsas.length
    offset += pageSize
    if (cbsas.length < pageSize) break
  }
  console.log(`    CBSAs: ${cbsaCount} loaded`)

  // Load ZCTAs (paginated - could be ~33K)
  let zctaCount = 0
  offset = 0
  while (true) {
    const { data: zctas } = await supabase
      .from('tiger_zcta')
      .select('geoid')
      .range(offset, offset + pageSize - 1)

    if (!zctas || zctas.length === 0) break

    for (const z of zctas) {
      zctaGeoids.add(z.geoid)
    }
    zctaCount += zctas.length
    offset += pageSize
    if (zctas.length < pageSize) break
  }
  console.log(`    ZCTAs: ${zctaCount} loaded`)

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`  Geoid cache loaded in ${elapsed}s`)
  cacheLoaded = true
}

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
 * Resolve county geoid from in-memory cache
 */
function resolveCountyGeoidCached(regionName: string, stateCode: string): string | null {
  let cleanName = regionName.replace(/,?\s*[A-Z]{2}$/, '')
  cleanName = cleanName.replace(/\s+County$/i, '').trim()

  const stateInfo = statesByAbbr.get(stateCode.toUpperCase())
  if (!stateInfo) return null

  const stateFips = stateInfo.geoid

  // Try exact match
  const exactKey = `${stateFips}|${cleanName.toLowerCase()}`
  const exact = countiesByStateFipsAndName.get(exactKey)
  if (exact) return exact

  // Try partial match
  const entries = countiesByStateFipsPartial.get(stateFips)
  if (entries) {
    const lower = cleanName.toLowerCase()
    const match = entries.find(e => e.name.includes(lower) || lower.includes(e.name))
    if (match) return match.geoid
  }

  return null
}

/**
 * Resolve state geoid from in-memory cache
 */
function resolveStateGeoidCached(regionName: string, stateCode?: string): string | null {
  if (stateCode) {
    return statesByAbbr.get(stateCode.toUpperCase())?.geoid || null
  }

  const cleanName = regionName.replace(/,?\s*[A-Z]{2}$/, '').trim().toLowerCase()
  const stateInfo = statesByNameLower.get(cleanName)
  if (stateInfo) return stateInfo.geoid

  // Try partial match
  for (const [name, info] of statesByNameLower) {
    if (name.includes(cleanName) || cleanName.includes(name)) {
      return info.geoid
    }
  }

  return null
}

/**
 * Resolve metro/MSA geoid from in-memory cache
 */
function resolveMetroGeoidCached(regionName: string): string | null {
  const cleanName = regionName.replace(/,?\s*[A-Z]{2}(-[A-Z]{2})?$/, '').trim().toLowerCase()

  // Try exact match
  const exact = cbsaByNameLower.get(cleanName)
  if (exact) return exact

  // Try partial match
  const match = cbsaByNamePartial.find(c => c.name.includes(cleanName) || cleanName.includes(c.name))
  return match?.geoid || null
}

/**
 * Resolve ZIP geoid from in-memory cache
 */
function resolveZipGeoidCached(regionName: string): string | null {
  const zipMatch = regionName.match(/\b(\d{5})\b/)
  if (!zipMatch) return null
  return zctaGeoids.has(zipMatch[1]) ? zipMatch[1] : null
}

/**
 * Resolve geoid using in-memory cache (no DB queries).
 * Falls back to synthetic geoid for unresolvable regions.
 */
export function resolveGeoidFromCache(
  regionName: string,
  regionType: string,
  stateCode?: string
): string {
  const normalizedType = regionType.toLowerCase()

  if (normalizedType === 'county' && stateCode) {
    const geoid = resolveCountyGeoidCached(regionName, stateCode)
    if (geoid) return geoid
  } else if (normalizedType === 'state') {
    const geoid = resolveStateGeoidCached(regionName, stateCode)
    if (geoid) return geoid
  } else if (normalizedType === 'metro' || normalizedType === 'msa') {
    const geoid = resolveMetroGeoidCached(regionName)
    if (geoid) return geoid
  } else if (normalizedType === 'zip' || normalizedType === 'zipcode') {
    const geoid = resolveZipGeoidCached(regionName)
    if (geoid) return geoid
  }

  // For city type and unresolved regions, generate a deterministic fallback
  return generateFallbackGeoid(normalizedType, regionName)
}

/**
 * Lookup county geoid from tiger_counties (DB query fallback)
 */
async function lookupCountyGeoid(
  supabase: SupabaseClient,
  regionName: string,
  stateCode: string,
  retries: number = 2
): Promise<string | null> {
  // Try cache first
  const cached = resolveCountyGeoidCached(regionName, stateCode)
  if (cached) return cached

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
 * Lookup state geoid from tiger_states (DB query fallback)
 */
async function lookupStateGeoid(
  supabase: SupabaseClient,
  regionName: string,
  stateCode?: string
): Promise<string | null> {
  const cached = resolveStateGeoidCached(regionName, stateCode)
  if (cached) return cached

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
 * Lookup metro/MSA geoid from tiger_cbsa (DB query fallback)
 */
async function lookupMetroGeoid(
  supabase: SupabaseClient,
  regionName: string
): Promise<string | null> {
  const cached = resolveMetroGeoidCached(regionName)
  if (cached) return cached

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
 * Lookup ZIP geoid from tiger_zcta (DB query fallback)
 */
async function lookupZipGeoid(
  supabase: SupabaseClient,
  regionName: string
): Promise<string | null> {
  const cached = resolveZipGeoidCached(regionName)
  if (cached) return cached

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
 * Get or create geoid for a region (with DB fallback for cache misses)
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

  // Try in-memory cache first (instant)
  if (cacheLoaded) {
    const cached = resolveGeoidFromCache(regionName, regionType, stateCode)
    // Only return cache result if it's a real geoid (not a fallback) or if it IS a city type (cities always get fallback)
    if (!cached.startsWith('REDFIN-') || normalizedType === 'city') {
      return cached
    }
  }

  try {
    // DB fallback for non-city regions that cache couldn't resolve
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
