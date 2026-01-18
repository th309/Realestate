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
  if (placeTypes.includes('country')) return 'national';
  if (placeTypes.includes('region')) return 'state';
  if (placeTypes.includes('postcode')) return 'zip';
  if (placeTypes.includes('district')) return 'county';
  if (placeTypes.includes('place')) return 'city';
  return null;
}

/**
 * Get Mapbox types string based on geography filter
 */
function getMapboxTypes(filterByGeoLevel?: GeographyType): string {
  switch (filterByGeoLevel) {
    case 'national':
      return 'country';
    case 'state':
      return 'region';
    case 'metro':
    case 'city':
      return 'place';
    case 'county':
      return 'district';
    case 'zip':
      return 'postcode';
    default:
      // All types for general search
      return 'country,region,place,district,postcode';
  }
}

/**
 * Hook for searching geographies using Mapbox Geocoding API
 * Returns Geography objects with center/bbox for map rendering
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
      const types = getMapboxTypes(filterByGeoLevel);

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
          let geoType = mapPlaceType(feature.place_type);

          // Override with filter if specified (e.g., city -> metro when filtering by metro)
          if (filterByGeoLevel && (filterByGeoLevel === 'metro' || filterByGeoLevel === 'city')) {
            geoType = filterByGeoLevel;
          } else if (filterByGeoLevel) {
            geoType = filterByGeoLevel;
          }

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
            // For counties, ensure "County" is in the name
            if (!name.toLowerCase().includes('county')) {
              name = `${name} County`;
            }
          } else if (geoType === 'state') {
            // For states, use full name
            name = feature.place_name.split(',')[0];
          } else if (geoType === 'national') {
            name = 'United States';
          }

          // Add state suffix for non-state, non-national types
          if (stateAbbrev && geoType !== 'state' && geoType !== 'national' && !name.includes(stateAbbrev)) {
            name = `${name}, ${stateAbbrev}`;
          }

          return {
            id: feature.id,
            type: geoType,
            name,
            state: stateAbbrev,
            center: feature.center,
            bbox: feature.bbox,
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

/**
 * Generate a Mapbox Static Map URL for a geography
 */
export function getStaticMapUrl(
  geography: Geography,
  width: number = 400,
  height: number = 200,
  style: string = 'mapbox/light-v11'
): string {
  if (!geography.center) return '';

  const [lng, lat] = geography.center;

  // Determine zoom based on geography type
  let zoom = 10;
  switch (geography.type) {
    case 'national': zoom = 3; break;
    case 'state': zoom = 5; break;
    case 'metro': zoom = 8; break;
    case 'county': zoom = 9; break;
    case 'city': zoom = 11; break;
    case 'zip': zoom = 13; break;
  }

  // If bbox is available, use auto zoom
  if (geography.bbox) {
    const [minLng, minLat, maxLng, maxLat] = geography.bbox;
    return `https://api.mapbox.com/styles/v1/${style}/static/[${minLng},${minLat},${maxLng},${maxLat}]/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
  }

  return `https://api.mapbox.com/styles/v1/${style}/static/${lng},${lat},${zoom}/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
}
