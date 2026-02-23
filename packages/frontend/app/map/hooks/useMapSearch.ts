'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { SearchResult, GeoLevel } from '../types';
import { ANIMATION_DURATIONS, MAP_PADDING } from '../config';
import { useUniversalSearch } from '../../shared/hooks/useUniversalSearch';

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
  /** @deprecated No longer used — search is backend-only */
  accessToken?: string;
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
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
  } = useUniversalSearch({});

  const searchNavigatedRef = useRef(false);


  // Handle search result selection — wrapped in useCallback so the URL-processing
  // effect in map/page.tsx has a stable dependency and doesn't re-fire every render.
  const handleSelectSearchResult = useCallback((result: SearchResult) => {
    console.log('Search result selected:', result);

    const zoomLevel = result.type === 'state' ? 5.5 :
      result.type === 'zip' ? 12 :
        result.type === 'county' ? 8 :
          result.type === 'city' ? 10 :
            result.type === 'metro' ? 7 : 10;

    if (!mapRef.current) {
      console.error('Map not initialized - cannot zoom');
    } else if (result.bbox && result.type !== 'metro') {
      mapRef.current.fitBounds(
        [[result.bbox[0], result.bbox[1]], [result.bbox[2], result.bbox[3]]],
        { padding: MAP_PADDING.FLY_TO, duration: ANIMATION_DURATIONS.MAP_FLY }
      );
    } else if (result.center) {
      mapRef.current.flyTo({
        center: result.center,
        zoom: zoomLevel,
        duration: ANIMATION_DURATIONS.MAP_FLY,
      });
    } else if (mapboxgl.accessToken) {
      // No center available — geocode the name as fallback
      const query = result.name.split(',')[0].split('-')[0].trim();
      const state = result.state ? `,${result.state}` : '';
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query + state)}.json?access_token=${mapboxgl.accessToken}&limit=1&country=us`;
      fetch(url).then(r => r.json()).then(data => {
        const feature = data.features?.[0];
        if (feature?.center && mapRef.current) {
          mapRef.current.flyTo({
            center: feature.center as [number, number],
            zoom: zoomLevel,
            duration: ANIMATION_DURATIONS.MAP_FLY,
          });
        }
      }).catch(() => { /* geocode failed, no zoom */ });
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
        onGeoLevelChange('city');
      }
    }

    clearSearch();
  }, [mapRef, onHighlightFeature, onGeoLevelChange, onStateChange, clearSearch]);

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
