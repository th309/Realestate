import { useState, useRef, useCallback, useEffect } from 'react';
import type { SearchResult } from '@/app/map/types';
import type { GeoLevel } from '@/app/map/config/metrics';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidHJveWhvdXN0b24iLCJhIjoiY21hZzFzaXJjMGEzcDJqcHByb29xM2lndSJ9.sataRzk3HaLNolfOnIc7Jw';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface MapboxContext {
    id: string;
    short_code?: string;
    text?: string;
}

interface MapboxFeature {
    id: string;
    place_name: string;
    place_type: string[];
    center: [number, number];
    bbox?: [number, number, number, number];
    context?: MapboxContext[];
}

interface Metro {
    regionId: number;
    name: string;
}

// Cache for all metros (loaded once, used for instant filtering)
let metrosCache: Metro[] | null = null;
let metrosLoadingPromise: Promise<Metro[]> | null = null;

async function loadAllMetros(): Promise<Metro[]> {
    if (metrosCache) return metrosCache;

    if (metrosLoadingPromise) return metrosLoadingPromise;

    metrosLoadingPromise = fetch(`${API_BASE_URL}/markets/metros`)
        .then(res => res.json())
        .then((data: Metro[]) => {
            metrosCache = data;
            return data;
        })
        .catch(err => {
            console.error('Failed to load metros:', err);
            metrosLoadingPromise = null;
            return [];
        });

    return metrosLoadingPromise;
}

export function useGraphSearch(geoLevel?: GeoLevel) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [metrosLoaded, setMetrosLoaded] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Preload metros when metro level is selected
    useEffect(() => {
        if (geoLevel === 'metro' && !metrosLoaded) {
            loadAllMetros().then(() => setMetrosLoaded(true));
        }
    }, [geoLevel, metrosLoaded]);

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

        try {
            // For metro level: use cached data for instant filtering
            if (geoLevel === 'metro') {
                const metros = await loadAllMetros();
                const lowerQuery = query.toLowerCase();

                const filtered = metros
                    .filter(m => m.name.toLowerCase().includes(lowerQuery))
                    .slice(0, 10)
                    .map(metro => ({
                        id: `metro-${metro.regionId}`,
                        name: metro.name,
                        type: 'metro' as const,
                        center: [0, 0] as [number, number],
                        state: '',
                    }));

                setSearchResults(filtered);
                setSearchLoading(false);
                return;
            }

            // For other levels: use Mapbox API
            const mapboxTypes = getMapboxTypes(geoLevel);
            const mapboxResponse = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                `access_token=${MAPBOX_TOKEN}&` +
                `country=US&` +
                `types=${mapboxTypes}&` +
                `limit=8`
            );

            const mapboxData = await mapboxResponse.json();
            const features: MapboxFeature[] = mapboxData.features || [];

            const results: SearchResult[] = features.map((feature: MapboxFeature) => {
                let type: SearchResult['type'] = 'city';
                if (feature.place_type.includes('region')) type = 'state';
                else if (feature.place_type.includes('postcode')) type = 'zip';
                else if (feature.place_type.includes('district')) type = 'county';
                else if (feature.place_type.includes('place')) type = 'city';

                const stateContext = feature.context?.find((c: MapboxContext) => c.id.startsWith('region'));
                const stateAbbrev = stateContext?.short_code?.replace('US-', '') || '';

                return {
                    id: feature.id,
                    name: feature.place_name,
                    type,
                    center: feature.center,
                    bbox: feature.bbox,
                    state: stateAbbrev,
                };
            });

            setSearchResults(results);
        } catch (err) {
            console.error('Search error:', err);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }, [geoLevel]);

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowSearchResults(false);
    };

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        searchLoading,
        showSearchResults,
        setShowSearchResults,
        searchRef,
        handleSearch,
        clearSearch
    };
}

// Get appropriate Mapbox types based on geo level
function getMapboxTypes(geoLevel?: GeoLevel): string {
    switch (geoLevel) {
        case 'state':
            return 'region';
        case 'county':
            return 'district';
        case 'city':
            return 'place';
        case 'zip':
            return 'postcode';
        default:
            return 'region,place,postcode,district';
    }
}
