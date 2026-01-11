'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { SearchResult, GeoLevel } from '../types';

interface UseMapSearchProps {
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  onGeoLevelChange: (level: GeoLevel) => void;
  onStateChange: (state: string) => void;
}

interface UseMapSearchReturn {
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  showSearchResults: boolean;
  searchRef: React.RefObject<HTMLDivElement>;
  searchNavigatedRef: React.MutableRefObject<boolean>;
  handleSearch: (query: string) => Promise<void>;
  handleSelectSearchResult: (result: SearchResult) => void;
  setShowSearchResults: (show: boolean) => void;
}

export function useMapSearch({
  mapRef,
  onGeoLevelChange,
  onStateChange,
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
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${mapboxgl.accessToken}&` +
        `country=US&` +
        `types=region,place,postcode,district&` +
        `limit=8`
      );
      const data = await response.json();

      const results: SearchResult[] = data.features?.map((feature: any) => {
        let type: SearchResult['type'] = 'city';
        if (feature.place_type.includes('region')) type = 'state';
        else if (feature.place_type.includes('postcode')) type = 'zip';
        else if (feature.place_type.includes('district')) type = 'county';
        else if (feature.place_type.includes('place')) type = 'city';

        const stateContext = feature.context?.find((c: any) => c.id.startsWith('region'));
        const stateAbbrev = stateContext?.short_code?.replace('US-', '') || '';

        return {
          id: feature.id,
          name: feature.place_name,
          type,
          center: feature.center as [number, number],
          bbox: feature.bbox as [number, number, number, number] | undefined,
          state: stateAbbrev,
        };
      }) || [];

      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Handle search result selection
  const handleSelectSearchResult = (result: SearchResult) => {
    console.log('Search result clicked:', result);

    if (!mapRef.current) {
      console.error('Map not initialized');
      return;
    }

    // Use fitBounds if bbox is available, otherwise fall back to flyTo with center
    if (result.bbox) {
      console.log('Fitting to bounds:', result.bbox);
      mapRef.current.fitBounds(
        [[result.bbox[0], result.bbox[1]], [result.bbox[2], result.bbox[3]]],
        { padding: 50, duration: 1000 }
      );
    } else if (result.center) {
      // Fallback zoom levels if no bbox available
      const zoomLevel = result.type === 'state' ? 5.5 :
                        result.type === 'zip' ? 12 :
                        result.type === 'county' ? 8 :
                        result.type === 'city' ? 10 : 8;

      console.log('Flying to:', result.center, 'zoom:', zoomLevel);
      mapRef.current.flyTo({
        center: result.center,
        zoom: zoomLevel,
        duration: 1000,
      });
    } else {
      console.error('No location data for result');
      return;
    }

    // Mark that search initiated this navigation (so geo level effect skips its zoom)
    searchNavigatedRef.current = true;

    // Update geo level and state based on result type
    if (result.type === 'state') {
      onGeoLevelChange('state');
    } else if (result.type === 'zip' && result.state) {
      onGeoLevelChange('zip');
      onStateChange(result.state);
    } else if (result.type === 'county') {
      onGeoLevelChange('county');
    } else if (result.type === 'city') {
      onGeoLevelChange('metro');
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
