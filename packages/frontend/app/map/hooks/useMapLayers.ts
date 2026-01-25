/**
 * Map Layers Hook
 */

import { useCallback, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import type { GeoLevel, ForecastHorizon, MapData, SelectedGeography } from '../types';
import { GEOJSON_SOURCES, FIPS_TO_STATE, STATE_NAME_TO_FIPS, getValueFromEntry, getDateFromEntry } from '../types';
import {
  getColorScale,
  getMetricFormat,
  calculateValueRange,
  formatTooltipValue,
  type MetricFormat,
} from '../utils';
import { getMetricDataDate, formatDataDateForDisplay } from '../config/metrics';
import { normalizeZipKey } from '@/lib/format/zip';

// API URL for backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Fetch with retry logic for large GeoJSON endpoints (county, zip)
 * These can timeout on cold cache, so retry up to 3 times with backoff
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      // Retry on 500 errors (cold cache timeout)
      if (response.status >= 500) {
        lastError = new Error(`Server error: ${response.status}`);
        if (attempt < maxRetries) {
          const delay = baseDelayMs * attempt; // Linear backoff: 1s, 2s, 3s
          console.warn(`GeoJSON fetch failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * attempt;
        console.warn(`GeoJSON fetch error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

interface UseMapLayersProps {
  map: React.MutableRefObject<mapboxgl.Map | null>;
  popup: React.MutableRefObject<mapboxgl.Popup | null>;
  geoLevel: GeoLevel;
  selectedState: string;
  selectedMetric: string;
  forecastHorizon: ForecastHorizon;
  mapData: MapData;
  mapLoaded: boolean;
  onFeatureClick?: (geography: SelectedGeography | null) => void;
}

export function useMapLayers({
  map,
  popup,
  geoLevel,
  selectedState,
  selectedMetric,
  forecastHorizon,
  mapData,
  mapLoaded,
  onFeatureClick
}: UseMapLayersProps) {
  // Store current geoLevel in ref for click handler
  const geoLevelRef = useRef(geoLevel);
  useEffect(() => {
    geoLevelRef.current = geoLevel;
  }, [geoLevel]);

  const updateMapLayers = useCallback(async () => {
    if (!map.current || !mapLoaded) return;

    if (!map.current.isStyleLoaded()) {
      map.current.once('idle', () => updateMapLayers());
      return;
    }

    // Remove existing layers and sources
    removeExistingLayers(map.current);

    // Get GeoJSON URL
    const geojsonUrl = getGeojsonUrl(geoLevel, selectedState);
    if (!geojsonUrl) return;

    try {
      // Use retry logic for county and zip (large datasets that can timeout on cold cache)
      const useRetry = geoLevel === 'county' || geoLevel === 'zip';
      const response = useRetry
        ? await fetchWithRetry(geojsonUrl, 3, 1000)
        : await fetch(geojsonUrl);
      const geojson = await response.json();

      // Add values to features
      addValuesToFeatures(geojson, geoLevel, mapData);

      // Remove source again right before adding (handles race condition)
      // This is needed because another updateMapLayers call may have started
      // while we were fetching the GeoJSON
      if (map.current!.getSource('geo-data')) {
        const layersToRemove = ['geo-fills', 'geo-borders', 'geo-labels'];
        layersToRemove.forEach(layerId => {
          if (map.current!.getLayer(layerId)) {
            map.current!.removeLayer(layerId);
          }
        });
        map.current!.removeSource('geo-data');
      }
      if (map.current!.getSource('geo-labels-data')) {
        map.current!.removeSource('geo-labels-data');
      }

      // Add source
      map.current!.addSource('geo-data', { type: 'geojson', data: geojson });

      // Create label points for state/national (single centered label per geography)
      const labelPointsGeojson = (geoLevel === 'state' || geoLevel === 'national')
        ? createLabelPoints(geojson, geoLevel)
        : undefined;

      // Determine metric format for display - uses shared utility for consistency with legend
      const metricFormat = getMetricFormat(selectedMetric);
      const { min: minVal, max: maxVal } = calculateValueRange(mapData, metricFormat, selectedMetric, geoLevel);

      // Add layers - uses same min/max as legend for consistent colors
      addMapLayers(map.current!, geoLevel, metricFormat, minVal, maxVal, labelPointsGeojson);

      // Setup hover and click interactions
      setupInteractions(map.current!, popup, metricFormat, forecastHorizon, geoLevelRef, selectedMetric, onFeatureClick);
    } catch (err) {
      console.error('Error loading GeoJSON:', err);
    }
  }, [geoLevel, mapData, mapLoaded, selectedState, selectedMetric, forecastHorizon, map, popup, onFeatureClick]);

  return { updateMapLayers };
}

function removeExistingLayers(map: mapboxgl.Map): void {
  const layersToRemove = ['geo-fills', 'geo-borders', 'geo-labels'];
  layersToRemove.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  });
  if (map.getSource('geo-data')) {
    map.removeSource('geo-data');
  }
  if (map.getSource('geo-labels-data')) {
    map.removeSource('geo-labels-data');
  }
}

function getGeojsonUrl(geoLevel: GeoLevel, selectedState: string): string | null {
  // All GeoJSON now comes from the backend API
  if (geoLevel === 'national') {
    return `${API_URL}${GEOJSON_SOURCES.national}`;
  } else if (geoLevel === 'state') {
    return `${API_URL}${GEOJSON_SOURCES.state}`;
  } else if (geoLevel === 'county') {
    // Use state-specific endpoint if state selected, otherwise all counties
    if (selectedState) {
      return `${API_URL}${GEOJSON_SOURCES.county}/${selectedState.toUpperCase()}`;
    }
    return `${API_URL}${GEOJSON_SOURCES.county}`;
  } else if (geoLevel === 'metro') {
    return `${API_URL}${GEOJSON_SOURCES.metro}`;
  } else if (geoLevel === 'city' && selectedState) {
    return `${API_URL}${GEOJSON_SOURCES.city}/${selectedState.toUpperCase()}`;
  } else if (geoLevel === 'zip' && selectedState) {
    return `${API_URL}${GEOJSON_SOURCES.zip}/${selectedState.toUpperCase()}`;
  } else if (geoLevel === 'tract' && selectedState) {
    // Tracts not yet available - table is empty
    console.warn('Tract data not available');
    return null;
  }
  return null;
}

function addValuesToFeatures(geojson: any, geoLevel: GeoLevel, mapData: MapData): void {
  if (geoLevel === 'national') {
    // National geojson has NAME: "United States", GEOID: "US"
    geojson.features.forEach((feature: any) => {
      const name = feature.properties.NAME || feature.properties.name || 'United States';
      // Try multiple keys: "United States", "US", name
      const entry = mapData['United States'] ?? mapData['US'] ?? mapData[name];
      feature.properties.value = getValueFromEntry(entry) || 0;
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = feature.properties.GEOID || 'US';
      feature.properties.displayName = name;
      // Normalize property names for consistent tooltip display
      feature.properties.name = name;
    });
  } else if (geoLevel === 'state') {
    geojson.features.forEach((feature: any) => {
      const name = feature.properties.name;
      const entry = mapData[name];
      feature.properties.value = getValueFromEntry(entry) || 0;
      feature.properties.dataDate = getDateFromEntry(entry);
      // Set state ID (FIPS code) for benchmark lookups
      // Try multiple sources: STATEFP property, name-to-FIPS lookup, feature.id
      const stateFips = feature.properties.STATEFP || STATE_NAME_TO_FIPS[name] || feature.id;
      feature.properties.id = stateFips;
      // Also set stateAbbr from FIPS for states
      feature.properties.stateAbbr = FIPS_TO_STATE[stateFips] || '';
    });
  } else if (geoLevel === 'county') {
    let countyWithData = 0;
    geojson.features.forEach((feature: any) => {
      const fips = feature.id || feature.properties.id;
      const entry = mapData[fips] ?? mapData[String(parseInt(fips, 10))];
      feature.properties.value = getValueFromEntry(entry);
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = fips;
      if (getValueFromEntry(entry) != null) countyWithData++;
      const stateFips = fips?.substring(0, 2);
      const stateAbbr = FIPS_TO_STATE[stateFips] || '';
      feature.properties.displayName = `${feature.properties.NAME || 'County'}, ${stateAbbr}`;
    });
    // One-off coverage check: compare to PropertyIQ "County coverage" log (score keys vs features)
    console.log(
      `[Map] County layer: ${geojson.features.length} features, ${Object.keys(mapData).length} data keys, ${countyWithData} features with value`
    );
  } else if (geoLevel === 'metro') {
    geojson.features.forEach((feature: any) => {
      const cbsaCode = feature.properties.CBSAFP || feature.properties.GEOID;
      const entry = mapData[cbsaCode];
      feature.properties.value = getValueFromEntry(entry);
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = cbsaCode;
      feature.properties.displayName = feature.properties.NAME || feature.properties.NAMELSAD || 'Metro Area';
    });
  } else if (geoLevel === 'city') {
    geojson.features.forEach((feature: any) => {
      // TIGER Place files use GEOID (state FIPS + place FIPS) and NAME
      // Zillow city data uses region_name (city name) as the key
      const placeId = feature.properties.GEOID || feature.properties.PLACEFP;
      const placeName = feature.properties.NAME || feature.properties.NAMELSAD || 'Unknown City';
      const stateFips = feature.properties.STATEFP;
      const stateAbbr = FIPS_TO_STATE[stateFips] || '';
      // Try matching by name first (Zillow data), then by GEOID
      const entry = mapData[placeName] ?? mapData[placeId];
      feature.properties.value = getValueFromEntry(entry);
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = placeId;
      feature.properties.displayName = stateAbbr ? `${placeName}, ${stateAbbr}` : placeName;
    });
  } else if (geoLevel === 'zip') {
    geojson.features.forEach((feature: any) => {
      const zipCode = feature.properties.ZCTA5CE20 || feature.properties.GEOID20;
      const key = zipCode ? normalizeZipKey(zipCode) : '';
      const entry = key ? mapData[key] : undefined;
      feature.properties.value = getValueFromEntry(entry);
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = zipCode;
      feature.properties.displayName = zipCode;
    });
  } else if (geoLevel === 'tract') {
    geojson.features.forEach((feature: any) => {
      // TIGER Tract files use GEOID (state FIPS + county FIPS + tract code)
      const tractId = feature.properties.GEOID || feature.properties.TRACTCE;
      const tractName = feature.properties.NAMELSAD || feature.properties.NAME || `Tract ${tractId}`;
      const stateFips = feature.properties.STATEFP;
      const countyFips = feature.properties.COUNTYFP;
      const stateAbbr = FIPS_TO_STATE[stateFips] || '';
      const entry = mapData[tractId];
      feature.properties.value = getValueFromEntry(entry);
      feature.properties.dataDate = getDateFromEntry(entry);
      feature.properties.id = tractId;
      feature.properties.displayName = `${tractName}${stateAbbr ? `, ${stateAbbr}` : ''}`;
      feature.properties.countyFips = stateFips + countyFips;
    });
  }
}

/**
 * Calculate the centroid of a polygon or multipolygon geometry
 * Uses bounding box center for label positioning
 * Returns [lng, lat] coordinates
 */
function calculateCentroid(geometry: any): [number, number] | null {
  if (!geometry || !geometry.coordinates) return null;

  let allCoords: [number, number][] = [];

  if (geometry.type === 'Polygon') {
    // Use the exterior ring (first array)
    allCoords = geometry.coordinates[0] || [];
  } else if (geometry.type === 'MultiPolygon') {
    // Collect all exterior rings from all polygons
    geometry.coordinates.forEach((polygon: any) => {
      if (polygon[0]) {
        allCoords = allCoords.concat(polygon[0]);
      }
    });
  }

  if (allCoords.length === 0) return null;

  // Calculate bounding box center
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  allCoords.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });

  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

/**
 * Create point features at the centroid of each polygon feature for labeling
 * This ensures only one label per geography, centered on the shape
 */
function createLabelPoints(geojson: any, geoLevel: GeoLevel): any {
  // For national level, create exactly ONE label point at the center of contiguous US
  // The national GeoJSON may have multiple features (continental US, Alaska, Hawaii, territories)
  // but we only want one centered label
  if (geoLevel === 'national') {
    // Use properties from first feature (they should all be "United States")
    const firstFeature = geojson.features[0];
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-98.5795, 39.8283] // Geographic center of contiguous US (Kansas)
        },
        properties: firstFeature ? { ...firstFeature.properties } : { name: 'United States', value: 0 }
      }]
    };
  }

  // For state level, create one point per feature at its centroid
  const labelFeatures = geojson.features.map((feature: any) => {
    const centroid = calculateCentroid(feature.geometry);
    if (!centroid) return null;

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: centroid
      },
      properties: { ...feature.properties }
    };
  }).filter(Boolean);

  return {
    type: 'FeatureCollection',
    features: labelFeatures
  };
}

function addMapLayers(
  map: mapboxgl.Map,
  geoLevel: GeoLevel,
  metricFormat: MetricFormat,
  minVal: number,
  maxVal: number,
  labelPointsGeojson?: any
): void {
  // Fill layer - uses dynamic min/max from calculateValueRange (same as legend)
  map.addLayer({
    id: 'geo-fills',
    type: 'fill',
    source: 'geo-data',
    paint: {
      'fill-color': getColorScale(minVal, maxVal) as any,
      'fill-opacity': 0.6,
    },
  });

  // Border layer
  const lineWidth = geoLevel === 'tract' ? 0.2 :
    geoLevel === 'zip' ? 0.3 :
      geoLevel === 'city' ? 0.4 :
        geoLevel === 'county' ? 0.5 :
          geoLevel === 'metro' ? 0.8 : 1.5;
  map.addLayer({
    id: 'geo-borders',
    type: 'line',
    source: 'geo-data',
    paint: {
      'line-color': '#ffffff',
      'line-width': lineWidth,
    },
  });

  // Labels for state and national level - use separate point source for centered labels
  if ((geoLevel === 'state' || geoLevel === 'national') && labelPointsGeojson) {
    // Add the label points source
    map.addSource('geo-labels-data', { type: 'geojson', data: labelPointsGeojson });

    // Build value format expression based on metric type
    let valueFormat: any;
    switch (metricFormat) {
      case 'percent':
        // Show as percentage with sign
        valueFormat = [
          'concat',
          ['case', ['>', ['get', 'value'], 0], '+', ''],
          ['number-format', ['get', 'value'], { 'min-fraction-digits': 1, 'max-fraction-digits': 1 }],
          '%'
        ];
        break;
      case 'percent_abs':
        // Absolute percentage (0-100%) - no sign
        valueFormat = [
          'concat',
          ['number-format', ['get', 'value'], { 'min-fraction-digits': 1, 'max-fraction-digits': 1 }],
          '%'
        ];
        break;
      case 'number':
      case 'index':
        // Plain number with thousands separator
        valueFormat = ['number-format', ['get', 'value'], { 'min-fraction-digits': 0, 'max-fraction-digits': 0 }];
        break;
      case 'days':
        // Number with "days" suffix
        valueFormat = [
          'concat',
          ['number-format', ['get', 'value'], { 'min-fraction-digits': 0, 'max-fraction-digits': 0 }],
          ' days'
        ];
        break;
      case 'currency':
      default:
        // Currency with $ prefix
        valueFormat = ['concat', '$', ['number-format', ['get', 'value'], { 'min-fraction-digits': 0, 'max-fraction-digits': 0 }]];
        break;
    }

    // M3 Typography: Use Roboto (with fallbacks), on-surface color #1d1b20
    map.addLayer({
      id: 'geo-labels',
      type: 'symbol',
      source: 'geo-labels-data',  // Use centroid points source for single centered labels
      layout: {
        'text-field': [
          'format',
          ['get', 'name'], { 'font-scale': 0.9, 'text-font': ['literal', ['Roboto Medium', 'DIN Pro Medium', 'Arial Unicode MS Bold']] },
          '\n', {},
          valueFormat,
          { 'font-scale': 0.8, 'text-font': ['literal', ['Roboto Regular', 'DIN Pro Regular', 'Arial Unicode MS Regular']] },
        ],
        'text-size': 15,  // M3 Label size (reduced 20% for better fit)
        'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'],  // Auto-shift to avoid collisions
        'text-radial-offset': 0.5,  // Offset when using non-center anchors
        'text-max-width': 8,
        'text-letter-spacing': 0.02,  // M3 tracking-wide for labels
      },
      paint: {
        'text-color': '#1d1b20',  // M3 on-surface color
        'text-halo-color': 'rgba(255, 255, 255, 0.95)',
        'text-halo-width': 2,
      },
    });
  }
}

function setupInteractions(
  map: mapboxgl.Map,
  popup: React.MutableRefObject<mapboxgl.Popup | null>,
  metricFormat: MetricFormat,
  forecastHorizon: ForecastHorizon,
  geoLevelRef: React.MutableRefObject<GeoLevel>,
  selectedMetric: string,
  onFeatureClick?: (geography: SelectedGeography | null) => void
): void {
  map.on('mouseenter', 'geo-fills', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'geo-fills', () => {
    map.getCanvas().style.cursor = '';
    popup.current?.remove();
  });

  map.on('mousemove', 'geo-fills', (e) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      const name = feature.properties?.name || feature.properties?.displayName || feature.properties?.NAME || 'Unknown';
      // Use null to indicate "no data" - don't convert 0 to null since 0 is a valid forecast value
      const value = feature.properties?.value ?? null;

      if (!popup.current) {
        popup.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });
      }

      // Use centralized formatting functions
      const { displayValue, valueColor } = formatTooltipValue(value, metricFormat);

      // Get "as of" date from central config (consistent across all maps/geographies)
      const configDate = getMetricDataDate(selectedMetric);
      const asOfText = `as of ${formatDataDateForDisplay(configDate)}`;

      // M3-compliant tooltip styling using CSS custom properties
      popup.current
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="
            font-family: 'Google Sans', Roboto, sans-serif;
            padding: 12px 16px;
            background: var(--md-surface-container-low, #f7f2fa);
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
          ">
            <div style="font-weight: 500; font-size: 14px; color: var(--md-on-surface, #1d1b20); line-height: 20px;">${name}</div>
            <div style="font-size: 22px; font-weight: 600; color: ${valueColor}; margin: 4px 0;">${displayValue}</div>
            <div style="font-size: 11px; color: var(--md-outline, #79747e); margin-top: 4px;">${asOfText}</div>
          </div>
        `)
        .addTo(map);
    }
  });

  // Click handler for benchmark comparison
  map.on('click', 'geo-fills', (e) => {
    if (!onFeatureClick || !e.features || e.features.length === 0) return;

    const feature = e.features[0];
    const props = feature.properties || {};

    // Extract geography info based on level
    const name = props.name || props.displayName || props.NAME || 'Unknown';
    const id = props.id || feature.id || '';
    const value = props.value ?? null;

    // Get state abbreviation if available
    const stateFips = props.STATEFP || (typeof id === 'string' ? id.substring(0, 2) : '');
    const stateAbbr = FIPS_TO_STATE[stateFips] || props.stateAbbr || '';

    onFeatureClick({
      id: String(id),
      name,
      geoLevel: geoLevelRef.current,
      value,
      stateAbbr
    });
  });

  // Click outside of features to deselect
  map.on('click', (e) => {
    if (!onFeatureClick) return;

    const features = map.queryRenderedFeatures(e.point, { layers: ['geo-fills'] });
    if (features.length === 0) {
      onFeatureClick(null);
    }
  });
}

