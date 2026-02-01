'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { SearchResult, GeoLevel } from '../types';
import { ANIMATION_DURATIONS, MAP_PADDING } from '../config';

// Mapbox Geocoding API response types
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

interface UseMapSearchProps {
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  onGeoLevelChange: (level: GeoLevel) => void;
  onStateChange: (state: string) => void;
  accessToken: string;
  geoLevel: GeoLevel;
}

interface UseMapSearchReturn {
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  showSearchResults: boolean;
  searchRef: React.RefObject<HTMLDivElement | null>;
  searchNavigatedRef: React.MutableRefObject<boolean>;
  highlightedFeature: SearchResult | null;
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
}: UseMapSearchProps): UseMapSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchNavigatedRef = useRef(false);

  const [highlightedFeature, setHighlightedFeature] = useState<SearchResult | null>(null);

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
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${token}&` +
        `country=US&` +
        `types=region,place,postcode,district,locality&` +
        `limit=8`
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Search response:', data);

      const features: MapboxFeature[] = data.features || [];
      const results: SearchResult[] = features.map((feature: MapboxFeature) => {
        let type: SearchResult['type'] = 'city';
        const name = feature.place_name;

        if (feature.place_type.includes('region')) type = 'state';
        else if (feature.place_type.includes('postcode')) type = 'zip';
        else if (feature.place_type.includes('district')) type = 'county';
        else if (feature.place_type.includes('place') || feature.place_type.includes('locality')) type = 'city';

        // Detect Metro areas (Mapbox often returns these as 'place' or 'district')
        if (name.toLowerCase().includes('metro') ||
          name.toLowerCase().includes('metropolitan area') ||
          name.toLowerCase().includes('msa') ||
          (name.includes('-') && name.includes(','))) { // e.g. "Dallas-Fort Worth, TX"
          type = 'metro';
        }

        const stateContext = feature.context?.find((c: MapboxContext) => c.id.startsWith('region'));
        const stateAbbrev = stateContext?.short_code?.replace('US-', '') || '';

        return {
          id: feature.id,
          name: type === 'zip' ? (feature as any).text || feature.place_name : feature.place_name,
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

    setHighlightedFeature({
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
    highlightedFeature,
    handleSearch,
    handleSelectSearchResult,
    setShowSearchResults,
  };
}
