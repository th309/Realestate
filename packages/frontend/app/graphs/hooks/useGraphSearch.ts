import { useState, useRef, useCallback, useEffect } from 'react';
import type { SearchResult } from '@/app/map/types';

// TODO: move to env or shared config
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

export function useGraphSearch() {
    const [searchQuery, setSearchQuery] = useState('');
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

        try {
            // Fetch from both Mapbox and our backend metros API in parallel
            const [mapboxResponse, metrosResponse] = await Promise.all([
                fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                    `access_token=${MAPBOX_TOKEN}&` +
                    `country=US&` +
                    `types=region,place,postcode,district&` +
                    `limit=6`
                ),
                fetch(`${API_BASE_URL}/markets/metros/search?q=${encodeURIComponent(query)}&limit=4`)
                    .catch(() => null) // Don't fail if backend is down
            ]);

            const mapboxData = await mapboxResponse.json();
            const metrosData = metrosResponse ? await metrosResponse.json().catch(() => []) : [];

            // Process Mapbox results
            const features: MapboxFeature[] = mapboxData.features || [];
            const mapboxResults: SearchResult[] = features.map((feature: MapboxFeature) => {
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

            // Process metro results from our backend
            const metroResults: SearchResult[] = (metrosData || []).map((metro: { regionId: number; name: string }) => ({
                id: `metro-${metro.regionId}`,
                name: metro.name,
                type: 'metro' as const,
                center: [0, 0] as [number, number], // We don't have coordinates for metros
                state: '',
            }));

            // Combine results: metros first (since user is looking for them), then other results
            // Filter out duplicate names (case-insensitive)
            const seenNames = new Set<string>();
            const combinedResults: SearchResult[] = [];

            // Add metro results first
            for (const result of metroResults) {
                const normalizedName = result.name.toLowerCase();
                if (!seenNames.has(normalizedName)) {
                    seenNames.add(normalizedName);
                    combinedResults.push(result);
                }
            }

            // Add Mapbox results
            for (const result of mapboxResults) {
                const normalizedName = result.name.toLowerCase();
                if (!seenNames.has(normalizedName)) {
                    seenNames.add(normalizedName);
                    combinedResults.push(result);
                }
            }

            setSearchResults(combinedResults.slice(0, 8));
        } catch (err) {
            console.error('Search error:', err);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }, []);

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
