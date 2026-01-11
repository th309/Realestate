/**
 * Redfin Data Center - Utility Functions
 * Helper functions for region mapping and market creation
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MarketRecord } from './types'

/**
 * Map Redfin region name to existing market region_id
 * Returns null if no match found (will create new market)
 */
export async function mapRedfinRegionToRegionId(
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

    const { data } = await query.limit(1).single()

    return data?.region_id || null
}

/**
 * Create a new market record from Redfin data
 * Returns the region_id of the created market
 */
export async function createMarketFromRedfinData(
    supabase: SupabaseClient,
    regionName: string,
    regionType: string,
    stateName?: string,
    stateCode?: string
): Promise<string | null> {
    // Generate a Redfin-specific region_id
    // Format: REDFIN-{TYPE}-{sanitized-name}[-{STATE}]
    // IMPORTANT: region_id must be <= 50 characters (VARCHAR(50) constraint)
    const typeUpper = regionType.toUpperCase()
    const statePart = stateCode ? `-${stateCode.toUpperCase()}` : ''
    const prefix = `REDFIN-${typeUpper}-` // e.g., "REDFIN-METRO-" = 13 chars
    const prefixLength = prefix.length + statePart.length
    const maxNameLength = 50 - prefixLength

    const sanitizedName = regionName
        .replace(/[^a-zA-Z0-9]/g, '-')
        .toUpperCase()
        .substring(0, Math.max(1, maxNameLength))

    let regionId = `${prefix}${sanitizedName}${statePart}`

    // Ensure region_id doesn't exceed 50 characters
    if (regionId.length > 50) {
        const excess = regionId.length - 50
        regionId = `${prefix}${sanitizedName.substring(0, sanitizedName.length - excess)}${statePart}`
    }

    const marketData: MarketRecord = {
        region_id: regionId,
        region_name: regionName,
        region_type: regionType,
        state_name: stateName || undefined,
        state_code: stateCode || undefined
    }

    if (regionType === 'msa') {
        marketData.metro_name = regionName.split(',')[0].trim()
    }

    // Upsert creates the market if it doesn't exist, updates if it does
    const { error } = await supabase
        .from('markets')
        .upsert(marketData, {
            onConflict: 'region_id',
            ignoreDuplicates: false
        })

    if (error) {
        console.error(`❌ Error creating market for ${regionName}:`, error.message)
        return null
    }

    console.log(`✅ Created market: ${regionName} (${regionId})`)
    return regionId
}

/**
 * Generate a cache key for region lookups
 */
export function getRegionCacheKey(
    name: string,
    type: string,
    stateCode?: string | null
): string {
    return `${type}|${stateCode || ''}|${name.toLowerCase()}`
}

/**
 * Clean UTF-16 encoded CSV data
 */
export function cleanUtf16CsvData(csvData: string): string {
    if (csvData.charCodeAt(0) === 0xFFFE || csvData.charCodeAt(0) === 0xFEFF || csvData.includes('\u0000')) {
        console.log('🔧 Detected UTF-16 encoding, converting to UTF-8...')

        if (typeof csvData === 'string' && csvData.includes('\u0000')) {
            let cleaned = ''
            for (let i = 0; i < csvData.length; i++) {
                const char = csvData[i]
                if (char !== '\u0000' && char !== '\uFFFE' && char !== '\uFEFF') {
                    cleaned += char
                }
            }
            csvData = cleaned

            if (csvData.length > 0 && (csvData.charCodeAt(0) === 0xFFFE || csvData.charCodeAt(0) === 0xFEFF)) {
                csvData = csvData.substring(1)
            }
        }

        console.log(`   Converted ${csvData.length} characters`)
    }
    return csvData
}

/**
 * Parse a CSV line with proper quote handling
 */
export function parseCsvLine(line: string, delimiter: string = ','): string[] {
    const values: string[] = []
    let currentValue = ''
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
        const char = line[j]
        if (char === '"') {
            inQuotes = !inQuotes
        } else if ((char === delimiter || char === '\t') && !inQuotes) {
            values.push(currentValue.trim().replace(/^"|"$/g, ''))
            currentValue = ''
        } else {
            currentValue += char
        }
    }
    if (currentValue) {
        values.push(currentValue.trim().replace(/^"|"$/g, ''))
    }

    return values
}
