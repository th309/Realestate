'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { SearchResult, GeoLevel } from '../types';
import { ANIMATION_DURATIONS, MAP_PADDING } from '../config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

interface UseMapSearchProps {
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  onGeoLevelChange: (level: GeoLevel) => void;
  onStateChange: (state: string) => void;
  accessToken: string;
  geoLevel: GeoLevel;
  onHighlightFeature: (feature: SearchResult | null) => void;
}

interface UseMapSearchReturn {
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  showSearchResults: boolean;
  searchRef: React.RefObject<HTMLDivElement | null>;
  searchNavigatedRef: React.MutableRefObject<boolean>;
  handleSearch: (query: string) => Promise<void>;
  handleSelectSearchResult: (result: SearchResult) => void;
  setShowSearchResults: (show: boolean) => void;
}

export function useMapSearch({
  mapRef,
  onGeoLevelChange,
  onStateChange,
  accessToken,
  geoLevel,
  onHighlightFeature,
}: UseMapSearchProps): UseMapSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchNavigatedRef = useRef(false);

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

  // Search function using Mapbox Geocoding API
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
      const token = accessToken || mapboxgl.accessToken;
      if (!token) {
        console.error('Mapbox access token is missing');
        setSearchLoading(false);
        return;
      }

      console.log('Searching for:', query);
      const queryLower = query.toLowerCase();

      // Parallel fetch: Mapbox for standard geos, and our backend for official CBSA metas
      const [mapboxRes, backendRes] = await Promise.all([
        fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
          `access_token=${token}&` +
          `country=US&` +
          `types=region,place,postcode,district,locality&` +
          `limit=8`
        ),
        fetch(`${API_URL}/api/geography/search?query=${encodeURIComponent(query)}&type=metro&limit=3`)
      ]);

      if (!mapboxRes.ok) throw new Error(`Mapbox search failed: ${mapboxRes.statusText}`);

      const mapboxData = await mapboxRes.json();
      const officialMetros: any[] = backendRes.ok ? await backendRes.json() : [];

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

        // Determine effective type - explicitly type to avoid union narrowing
        let effectiveType: SearchResult['type'] = type;
        if (isMetroFeature || (hasMetroIntent && type === 'city')) {
          effectiveType = 'metro';
        }

        const primaryResult: SearchResult = {
          id: feature.id,
          name: effectiveType === 'zip' ? feature.text || name : name,
          type: effectiveType,
          subtitle: effectiveType === 'metro' ? 'Metropolitan Statistical Area' : undefined,
          center: feature.center,
          bbox: feature.bbox,
          state: stateAbbrev,
        };

        // If it's a city, we'll try to find a matching official metro from our backend results
        if (type === 'city') {
          const baseName = feature.text || name.split(',')[0];

          // Find if we have an official metro starting with this city's name
          const matchingMetro = officialMetros.find(m =>
            m.name.toLowerCase().startsWith(baseName.toLowerCase()) ||
            m.cbsa_name?.toLowerCase().includes(baseName.toLowerCase())
          );

          if (matchingMetro) {
            const metroResult: SearchResult = {
              id: matchingMetro.geography_id,
              name: matchingMetro.name,
              type: 'metro',
              subtitle: 'Metropolitan Statistical Area',
              center: (matchingMetro.longitude && matchingMetro.latitude)
                ? [Number(matchingMetro.longitude), Number(matchingMetro.latitude)]
                : (feature.center as [number, number]),
              state: matchingMetro.state_code,
            };
            return [primaryResult, metroResult];
          }

          // 2. Synthetic Fallback if no matching official metro found
          // This ensures a "seamless" discoverability path even if backend data is missing.
          const metroResultFallback: SearchResult = {
            ...primaryResult,
            id: `${feature.id}-metro-companion`,
            name: `${baseName} Metro Area`,
            type: 'metro',
            subtitle: 'Metropolitan Statistical Area',
          };
          return [primaryResult, metroResultFallback];
        }

        // If the result itself was identified as a metro by Mapbox, try to fix its name and coords to official
        if (effectiveType === 'metro') {
          const officialMatch = officialMetros[0]; // Use first official result as bias
          if (officialMatch) {
            primaryResult.name = officialMatch.name;
            primaryResult.id = officialMatch.geography_id;
            if (officialMatch.longitude && officialMatch.latitude) {
              primaryResult.center = [Number(officialMatch.longitude), Number(officialMatch.latitude)];
            }
          }
        }

        return [primaryResult];
      });

      // Also add any official metros that didn't match a city specifically
      const matchedIds = new Set(results.filter(r => r.type === 'metro').map(r => r.id));
      const extraMetros: SearchResult[] = officialMetros
        .filter(m => !matchedIds.has(m.geography_id))
        .map(m => ({
          id: m.geography_id,
          name: m.name,
          type: 'metro',
          subtitle: 'Metropolitan Statistical Area',
          state: m.state_code,
          center: (m.longitude && m.latitude)
            ? [Number(m.longitude), Number(m.latitude)]
            : undefined,
        }));

      setSearchResults([...results, ...extraMetros].slice(0, 10));
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [accessToken]);

  // Handle search result selection
  const handleSelectSearchResult = (result: SearchResult) => {
    console.log('Search result clicked:', result);

    if (!mapRef.current) {
      console.error('Map not initialized - cannot zoom');
    } else {
      // Use fitBounds if bbox is available, otherwise fall back to flyTo with center
      // IMPORTANT: BBox provides the "correct" zoom to see the whole geometry
      if (result.bbox) {
        console.log('Fitting to bounds:', result.bbox);
        mapRef.current.fitBounds(
          [[result.bbox[0], result.bbox[1]], [result.bbox[2], result.bbox[3]]],
          { padding: MAP_PADDING.FLY_TO, duration: ANIMATION_DURATIONS.MAP_FLY }
        );
      } else if (result.center) {
        // Fallback zoom levels if no bbox available
        const zoomLevel = result.type === 'state' ? 5.5 :
          result.type === 'zip' ? 12 :
            result.type === 'county' ? 8 :
              result.type === 'city' ? 10 :
                result.type === 'metro' ? 8 : 10;

        console.log('Flying to:', result.center, 'zoom:', zoomLevel);
        mapRef.current.flyTo({
          center: result.center,
          zoom: zoomLevel,
          duration: ANIMATION_DURATIONS.MAP_FLY,
        });
      }
    }

    // Mark that search initiated this navigation (so geo level effect skips its zoom)
    searchNavigatedRef.current = true;

    // Set highlighted feature - strip common suffixes for better matching with backend data
    let cleanName = result.name.split(',')[0]; // Take first part "Austin" from "Austin, Texas"

    // For County, strip " County" or " Parish" if present (backend usually just has "Travis")
    if (result.type === 'county') {
      cleanName = cleanName.replace(/ County$/i, '').replace(/ Parish$/i, '');
    }

    onHighlightFeature({
      ...result,
      name: cleanName
    });

    // Update geo level and state based on result type
    // Universal logic: The search result determines the mode.
    if (result.type === 'state') {
      onGeoLevelChange('state');
    } else if (result.type === 'zip' && result.state) {
      onGeoLevelChange('zip');
      onStateChange(result.state);
    } else if (result.type === 'metro') {
      onGeoLevelChange('metro');
    } else if (result.type === 'county') {
      onGeoLevelChange('county');
    } else if (result.type === 'city') {
      if (result.state) {
        onGeoLevelChange('city');
        onStateChange(result.state);
      } else {
        // Fallback to city anyway if state missing, backend might still match
        onGeoLevelChange('city');
      }
    }

    // Clear search
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  return {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    searchRef,
    searchNavigatedRef,
    handleSearch,
    handleSelectSearchResult,
    setShowSearchResults,
  };
}
