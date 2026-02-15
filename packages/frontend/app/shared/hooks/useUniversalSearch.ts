import { useState, useRef, useCallback, useEffect } from 'react';
import { MAPBOX_ACCESS_TOKEN, API_URL } from '@/app/map/config';
import type { SearchResult } from '@/app/map/types';

// Mapbox Geocoding API response types
interface MapboxContext {
    id: string;
    short_code?: string;
    text?: string;
}

interface MapboxFeature {
    id: string;
    place_name: string;
    text?: string;
    place_type: string[];
    center: [number, number];
    bbox?: [number, number, number, number];
    context?: MapboxContext[];
}

/**
 * Parse the primary state abbreviation from a geography name.
 * Handles patterns like:
 *   "Chicago-Naperville-Elgin, IL-IN" → "IL"
 *   "Houston-Pasadena-The Woodlands, TX" → "TX"
 *   "Cook County, IL" → "IL"
 * Returns null if no match found.
 */
function parseStateFromName(name: string): string | null {
    const match = name.match(/,\s*([A-Z]{2})(?:-[A-Z]{2})*\s*$/);
    return match ? match[1] : null;
}

/**
 * Resolve the state abbreviation for a search result.
 * Prefers the name-parsed state (reliable for multi-state metros) over the
 * database state_code (which may be wrong for multi-state geographies).
 */
function resolveState(name: string, dbStateCode?: string): string {
    return parseStateFromName(name) || dbStateCode || '';
}

interface UseUniversalSearchProps {
    accessToken?: string;
    initialQuery?: string;
    filterByGeoLevel?: string; // Optional: restrict results to a specific level
}

export function useUniversalSearch({
    accessToken,
    initialQuery = '',
    filterByGeoLevel,
}: UseUniversalSearchProps) {
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);

        if (query.length < 2) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        setSearchLoading(true);
        setShowSearchResults(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            const token = accessToken || MAPBOX_ACCESS_TOKEN || (typeof window !== 'undefined' ? (window as any).mapboxgl?.accessToken : '');

            console.log(`[Search] Query: "${query}", Filter: ${filterByGeoLevel || 'none'}, URL: ${API_URL}`);

            if (!token) {
                console.warn('[Search] No Mapbox token found');
            }

            const queryLower = query.toLowerCase();

            // Determine Mapbox types based on filter
            let mapboxTypes = 'region,place,postcode,district,locality';
            if (filterByGeoLevel) {
                switch (filterByGeoLevel) {
                    case 'state': mapboxTypes = 'region'; break;
                    case 'city': mapboxTypes = 'place,locality'; break;
                    case 'zip': mapboxTypes = 'postcode'; break;
                    case 'county': mapboxTypes = 'district'; break;
                    case 'metro': mapboxTypes = 'place,district'; break;
                }
            }

            const shouldCheckMetros = !filterByGeoLevel || filterByGeoLevel === 'metro';
            const shouldCheckCounties = !filterByGeoLevel || filterByGeoLevel === 'county';

            // Parallel fetch
            const [mapboxRes, metroRes, countyRes] = await Promise.all([
                token ? fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                    `access_token=${token}&` +
                    `country=US&` +
                    `types=${mapboxTypes}&` +
                    `limit=8`,
                    { signal: controller.signal }
                ).catch(err => {
                    console.error('[Search] Mapbox fetch failed:', err);
                    return { ok: false, statusText: err.message } as Response;
                }) : Promise.resolve({ ok: false, statusText: 'No Token' } as Response),

                shouldCheckMetros ? fetch(
                    `${API_URL}/api/geography/search?query=${encodeURIComponent(query)}&type=metro&limit=5`,
                    { signal: controller.signal }
                ).catch(err => {
                    console.error('[Search] Metro fetch failed:', err);
                    return { ok: false, statusText: err.message } as Response;
                }) : Promise.resolve({ ok: false, statusText: 'Skipped' } as Response),

                shouldCheckCounties ? fetch(
                    `${API_URL}/api/geography/search?query=${encodeURIComponent(query)}&type=county&limit=5`,
                    { signal: controller.signal }
                ).catch(err => {
                    console.error('[Search] County fetch failed:', err);
                    return { ok: false, statusText: err.message } as Response;
                }) : Promise.resolve({ ok: false, statusText: 'Skipped' } as Response)
            ]);

            clearTimeout(timeoutId);

            if (mapboxRes && !mapboxRes.ok) {
                console.warn(`[Search] Mapbox returned error: ${mapboxRes.statusText}`);
            }
            if (metroRes && !metroRes.ok) {
                console.warn(`[Search] Metro search returned error: ${metroRes.statusText}`);
            }
            if (countyRes && !countyRes.ok) {
                console.warn(`[Search] County search returned error: ${countyRes.statusText}`);
            }

            const mapboxData = (mapboxRes && mapboxRes.ok) ? await mapboxRes.json() : { features: [] };
            const officialMetros = (metroRes && metroRes.ok) ? await metroRes.json() : [];
            const officialCounties = (countyRes && countyRes.ok) ? await countyRes.json() : [];

            console.log(`[Search] Received: ${mapboxData.features?.length || 0} Mapbox, ${officialMetros?.length || 0} metros, ${officialCounties?.length || 0} counties`);

            const features: MapboxFeature[] = mapboxData.features || [];
            const results: SearchResult[] = features.flatMap((feature: MapboxFeature) => {
                const name = feature.place_name;
                let type: SearchResult['type'] = 'city';

                if (feature.place_type.includes('region')) type = 'state';
                else if (feature.place_type.includes('postcode')) type = 'zip';
                else if (feature.place_type.includes('district')) type = 'county';
                else if (feature.place_type.includes('place') || feature.place_type.includes('locality')) type = 'city';

                // Detect Metro intent (user specifically asked for metro)
                const hasMetroIntent = queryLower.includes('metro') || queryLower.includes('msa');

                // Check if the result itself is a metro (Mapbox sometimes returns MSAs as places)
                const isMetroFeature = name.toLowerCase().includes('metro') ||
                    name.toLowerCase().includes('metropolitan area') ||
                    name.toLowerCase().includes('msa') ||
                    (name.includes('-') && name.includes(','));

                const stateContext = feature.context?.find((c: MapboxContext) => c.id.startsWith('region'));
                const stateAbbrev = stateContext?.short_code?.replace('US-', '') || '';

                // Determine effective type
                let effectiveType: SearchResult['type'] = type;
                if (isMetroFeature || (hasMetroIntent && type === 'city')) {
                    effectiveType = 'metro';
                }

                // Apply filter if present
                if (filterByGeoLevel && filterByGeoLevel !== effectiveType) {
                    // Exception: if we are filtering for metro, we accept cities that we can turn into metros
                    if (!(filterByGeoLevel === 'metro' && type === 'city')) {
                        return [];
                    }
                }

                // For counties, try to match with backend to get proper fips_code
                let countyId = feature.id;
                let countyName = name;
                if (type === 'county') {
                    const baseName = feature.text || name.split(',')[0];
                    const matchingCounty = officialCounties.find((c: any) =>
                        c.name.toLowerCase().includes(baseName.toLowerCase()) &&
                        (!stateAbbrev || c.state_code === stateAbbrev)
                    );
                    if (matchingCounty) {
                        // Use fips_code for counties (this is what metric data is keyed by)
                        countyId = matchingCounty.fips_code || matchingCounty.geography_id;
                        countyName = matchingCounty.name;
                    }
                }

                const resolvedName = effectiveType === 'zip' ? feature.text || name :
                    effectiveType === 'county' ? countyName : name;

                const primaryResult: SearchResult = {
                    // For ZIPs, use the actual postal code (feature.text) as ID, not Mapbox's internal ID
                    // For counties, use fips_code from backend match
                    id: effectiveType === 'zip' ? (feature.text || feature.id) :
                        effectiveType === 'county' ? countyId : feature.id,
                    name: resolvedName,
                    type: effectiveType,
                    subtitle: effectiveType === 'metro' ? 'Metropolitan Statistical Area' : undefined,
                    center: feature.center,
                    bbox: feature.bbox,
                    state: resolveState(resolvedName, stateAbbrev),
                };

                // If it's a city (or we are specifically looking for metros), try to find/create a companion
                if (type === 'city' && (!filterByGeoLevel || filterByGeoLevel === 'metro')) {
                    const baseName = feature.text || name.split(',')[0];

                    // 1. Try Official Match first
                    const matchingMetro = officialMetros.find((m: any) =>
                        m.name.toLowerCase().startsWith(baseName.toLowerCase()) ||
                        m.cbsa_name?.toLowerCase().includes(baseName.toLowerCase())
                    );

                    if (matchingMetro) {
                        const metroResult: SearchResult = {
                            // Use cbsa_code for metros (this is what metric data is keyed by)
                            id: matchingMetro.cbsa_code || matchingMetro.geography_id,
                            name: matchingMetro.name,
                            type: 'metro',
                            subtitle: 'Metropolitan Statistical Area',
                            center: (matchingMetro.longitude && matchingMetro.latitude)
                                ? [Number(matchingMetro.longitude), Number(matchingMetro.latitude)]
                                : (feature.center as [number, number]),
                            state: resolveState(matchingMetro.name, matchingMetro.state_code),
                        };

                        // If filtering specifically for metros, ONLY return the metro
                        if (filterByGeoLevel === 'metro') return [metroResult];
                        return [primaryResult, metroResult];
                    }

                    // 2. Synthetic Fallback
                    const metroResultFallback: SearchResult = {
                        ...primaryResult,
                        id: `${feature.id}-metro-companion`,
                        name: `${baseName} Metro Area`,
                        type: 'metro',
                        subtitle: 'Metropolitan Statistical Area',
                    };

                    if (filterByGeoLevel === 'metro') return [metroResultFallback];
                    return [primaryResult, metroResultFallback];
                }

                return [primaryResult];
            });

            // Also add any official metros that didn't match a city specifically
            const matchedMetroIds = new Set(results.filter(r => r.type === 'metro').map(r => r.id));
            const extraMetros: SearchResult[] = officialMetros
                .filter((m: any) => !matchedMetroIds.has(m.cbsa_code || m.geography_id))
                .map((m: any) => ({
                    // Use cbsa_code for metros (this is what metric data is keyed by)
                    id: m.cbsa_code || m.geography_id,
                    name: m.name,
                    type: 'metro' as const,
                    subtitle: 'Metropolitan Statistical Area',
                    state: resolveState(m.name, m.state_code),
                    center: (m.longitude && m.latitude)
                        ? [Number(m.longitude), Number(m.latitude)]
                        : undefined,
                }));

            // Also add any official counties that didn't match Mapbox results
            const matchedCountyIds = new Set(results.filter(r => r.type === 'county').map(r => r.id));
            const extraCounties: SearchResult[] = officialCounties
                .filter((c: any) => !matchedCountyIds.has(c.fips_code || c.geography_id))
                .map((c: any) => ({
                    // Use fips_code for counties (this is what metric data is keyed by)
                    id: c.fips_code || c.geography_id,
                    name: c.name,
                    type: 'county' as const,
                    state: resolveState(c.name, c.state_code),
                    center: (c.longitude && c.latitude)
                        ? [Number(c.longitude), Number(c.latitude)]
                        : undefined,
                }));

            let finalResults = [...results, ...extraMetros, ...extraCounties];

            // Final filter pass for extraMetros if filtered
            if (filterByGeoLevel) {
                finalResults = finalResults.filter((r: SearchResult) => r.type === filterByGeoLevel);
            }

            // Deduplicate by ID to prevent React key warnings
            // Multiple cities (e.g., Dallas + Fort Worth) can match the same metro
            const seenIds = new Set<string>();
            finalResults = finalResults.filter((r: SearchResult) => {
                if (seenIds.has(r.id)) {
                    return false;
                }
                seenIds.add(r.id);
                return true;
            });

            setSearchResults(finalResults.slice(0, 10));
        } catch (err) {
            console.error('Search error:', err);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }, [accessToken, filterByGeoLevel]);

    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setSearchResults([]);
        setShowSearchResults(false);
    }, []);

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        searchLoading,
        showSearchResults,
        setShowSearchResults,
        searchRef,
        handleSearch,
        clearSearch,
    };
}
