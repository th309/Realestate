'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { SearchResult, GeoLevel } from '../types';
import { ANIMATION_DURATIONS, MAP_PADDING } from '../config';
import { useUniversalSearch } from '../../shared/hooks/useUniversalSearch';

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
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
  } = useUniversalSearch({ accessToken });

  const searchNavigatedRef = useRef(false);


  // Handle search result selection
  const handleSelectSearchResult = (result: SearchResult) => {
    console.log('Search result clicked:', result);

    if (!mapRef.current) {
      console.error('Map not initialized - cannot zoom');
    } else {
      // Use fitBounds if bbox is available, otherwise fall back to flyTo with center
      // IMPORTANT: BBox provides the "correct" zoom to see the whole geometry.
      // However, for metros, we currently lack MSA-level bboxes, so we force a bird's-eye view.
      if (result.bbox && result.type !== 'metro') {
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
                result.type === 'metro' ? 7 : 10;

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
    clearSearch();
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
