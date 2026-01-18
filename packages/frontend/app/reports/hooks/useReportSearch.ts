import { useState, useRef, useCallback, useEffect } from 'react';
import type { Geography, GeographyType } from '../types';

// TODO: move to env or shared config
const MAPBOX_TOKEN = 'pk.eyJ1IjoidHJveWhvdXN0b24iLCJhIjoiY21hZzFzaXJjMGEzcDJqcHByb29xM2lndSJ9.sataRzk3HaLNolfOnIc7Jw';

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
  text?: string;
}

/**
 * Map Mapbox place types to our GeographyType
 */
function mapPlaceType(placeTypes: string[]): GeographyType | null {
  if (placeTypes.includes('postcode')) return 'zip';
  if (placeTypes.includes('district')) return 'county';
  // place (city) maps to metro for our purposes
  if (placeTypes.includes('place')) return 'metro';
  return null;
}

/**
 * Hook for searching geographies using Mapbox Geocoding API
 * Similar to useGraphSearch but returns Geography type for reports
 */
export function useReportSearch(filterByGeoLevel?: GeographyType) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Geography[]>([]);
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
      // Build types parameter based on filter
      // place = city (we'll map to metro)
      // district = county
      // postcode = zip
      let types = 'place,postcode,district';
      if (filterByGeoLevel === 'metro') {
        types = 'place';
      } else if (filterByGeoLevel === 'county') {
        types = 'district';
      } else if (filterByGeoLevel === 'zip') {
        types = 'postcode';
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${MAPBOX_TOKEN}&` +
        `country=US&` +
        `types=${types}&` +
        `limit=8`
      );
      const data = await response.json();

      const features: MapboxFeature[] = data.features || [];
      const results: Geography[] = features
        .map((feature: MapboxFeature): Geography | null => {
          const geoType = mapPlaceType(feature.place_type);
          if (!geoType) return null;

          // Extract state from context
          const stateContext = feature.context?.find((c: MapboxContext) => c.id.startsWith('region'));
          const stateAbbrev = stateContext?.short_code?.replace('US-', '') || '';

          // Build a readable name
          let name = feature.text || feature.place_name;
          if (geoType === 'zip') {
            // For zip codes, include city name if available
            const placeContext = feature.context?.find((c: MapboxContext) => c.id.startsWith('place'));
            if (placeContext?.text) {
              name = `${feature.text} - ${placeContext.text}`;
            }
          } else if (geoType === 'county') {
            // For counties, append "County" if not present and add state
            if (!name.toLowerCase().includes('county')) {
              name = `${name} County`;
            }
          }

          // Add state suffix if we have it
          if (stateAbbrev && !name.includes(stateAbbrev)) {
            name = `${name}, ${stateAbbrev}`;
          }

          return {
            id: feature.id,
            type: geoType,
            name,
            state: stateAbbrev,
          };
        })
        .filter((geo): geo is Geography => geo !== null);

      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [filterByGeoLevel]);

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
    clearSearch,
  };
}
