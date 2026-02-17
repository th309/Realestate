/**
 * UNIVERSAL SEARCH HOOK
 *
 * Single-source search backed by the backend geographies table.
 * Returns metros, counties, zips, and states with correct IDs
 * (CBSA codes, FIPS codes, postal codes) ready for metric lookups.
 *
 * Backend provides: geography_id, geography_type, name, state_code,
 * cbsa_code, cbsa_name, latitude, longitude, population.
 * Results are sorted by population (largest first).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { SearchResult } from '@/app/map/types';

// Inline env var for client-side usage — NEXT_PUBLIC_ vars are replaced at build time
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    initialQuery?: string;
    filterByGeoLevel?: string; // Optional: restrict results to a specific type
    /** @deprecated No longer used — search is backend-only */
    accessToken?: string;
}

export function useUniversalSearch({
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
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Single backend call — geographies table has all types
            const params = new URLSearchParams({
                query,
                limit: '15',
            });
            if (filterByGeoLevel) {
                params.set('type', filterByGeoLevel);
            }

            const response = await fetch(
                `${API_URL}/api/geography/search?${params.toString()}`,
                { signal: controller.signal }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`[Search] Backend error: ${response.status} ${response.statusText}`);
                setSearchResults([]);
                return;
            }

            const geographies: any[] = await response.json();

            // Map backend results to SearchResult shape
            const results: SearchResult[] = geographies.map((geo) => ({
                id: geo.geography_id,
                name: geo.name,
                type: geo.geography_type as SearchResult['type'],
                subtitle: geo.geography_type === 'metro'
                    ? 'Metropolitan Statistical Area'
                    : geo.geography_type === 'county' && geo.cbsa_name
                        ? geo.cbsa_name
                        : undefined,
                center: (geo.longitude != null && geo.latitude != null)
                    ? [Number(geo.longitude), Number(geo.latitude)] as [number, number]
                    : undefined,
                state: resolveState(geo.name, geo.state_code),
            }));

            setSearchResults(results.slice(0, 10));
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('[Search] Error:', err);
            }
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }, [filterByGeoLevel]);

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
