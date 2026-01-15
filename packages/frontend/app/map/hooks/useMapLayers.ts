/**
 * Map Layers Hook
 */

import { useCallback, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import type { GeoLevel, ForecastHorizon, HomeValues, SelectedGeography } from '../types';
import { GEOJSON_SOURCES, FIPS_TO_STATE } from '../types';
import {
  getColorScale,
  getMetricFormat,
  calculateValueRange,
  type MetricFormat,
} from '../utils';

// API URL for backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UseMapLayersProps {
  map: React.MutableRefObject<mapboxgl.Map | null>;
  popup: React.MutableRefObject<mapboxgl.Popup | null>;
  geoLevel: GeoLevel;
  selectedState: string;
  selectedMetric: string;
  forecastHorizon: ForecastHorizon;
  homeValues: HomeValues;
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
  homeValues,
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
      const response = await fetch(geojsonUrl);
      const geojson = await response.json();

      // Add values to features
      addValuesToFeatures(geojson, geoLevel, homeValues);

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

      // Add source
      map.current!.addSource('geo-data', { type: 'geojson', data: geojson });

      // Determine metric format for display - uses shared utility for consistency with legend
      const metricFormat = getMetricFormat(selectedMetric);
      const { min: minVal, max: maxVal } = calculateValueRange(homeValues, metricFormat);

      // Add layers
      addMapLayers(map.current!, geoLevel, metricFormat, minVal, maxVal);

      // Setup hover and click interactions
      setupInteractions(map.current!, popup, metricFormat, forecastHorizon, geoLevelRef, onFeatureClick);
    } catch (err) {
      console.error('Error loading GeoJSON:', err);
    }
  }, [geoLevel, homeValues, mapLoaded, selectedState, selectedMetric, forecastHorizon, map, popup, onFeatureClick]);

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
}

function getGeojsonUrl(geoLevel: GeoLevel, selectedState: string): string | null {
  // All GeoJSON now comes from the backend API
  if (geoLevel === 'state' || geoLevel === 'national') {
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

function addValuesToFeatures(geojson: any, geoLevel: GeoLevel, homeValues: HomeValues): void {
  if (geoLevel === 'state' || geoLevel === 'national') {
    geojson.features.forEach((feature: any) => {
      const name = feature.properties.name;
      feature.properties.value = homeValues[name] || 0;
    });
  } else if (geoLevel === 'county') {
    geojson.features.forEach((feature: any) => {
      const fips = feature.id || feature.properties.id;
      feature.properties.value = homeValues[fips] ?? homeValues[String(parseInt(fips, 10))] ?? null;
      feature.properties.id = fips;
      const stateFips = fips?.substring(0, 2);
      const stateAbbr = FIPS_TO_STATE[stateFips] || '';
      feature.properties.displayName = `${feature.properties.NAME || 'County'}, ${stateAbbr}`;
    });
  } else if (geoLevel === 'metro') {
    geojson.features.forEach((feature: any) => {
      const cbsaCode = feature.properties.CBSAFP || feature.properties.GEOID;
      feature.properties.value = homeValues[cbsaCode] ?? null;
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
      feature.properties.value = homeValues[placeName] ?? homeValues[placeId] ?? null;
      feature.properties.id = placeId;
      feature.properties.displayName = stateAbbr ? `${placeName}, ${stateAbbr}` : placeName;
    });
  } else if (geoLevel === 'zip') {
    geojson.features.forEach((feature: any) => {
      const zipCode = feature.properties.ZCTA5CE20 || feature.properties.GEOID20;
      feature.properties.value = homeValues[zipCode] ?? null;
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
      feature.properties.value = homeValues[tractId] ?? null;
      feature.properties.id = tractId;
      feature.properties.displayName = `${tractName}${stateAbbr ? `, ${stateAbbr}` : ''}`;
      feature.properties.countyFips = stateFips + countyFips;
    });
  }
}

function addMapLayers(
  map: mapboxgl.Map,
  geoLevel: GeoLevel,
  metricFormat: MetricFormat,
  minVal?: number,
  maxVal?: number
): void {
  // For color scale, we need to know specific metric types
  const isForecast = metricFormat === 'percent';
  const isRenterDemand = metricFormat === 'index';
  const isInventory = metricFormat === 'number' || metricFormat === 'days';

  // Fill layer
  map.addLayer({
    id: 'geo-fills',
    type: 'fill',
    source: 'geo-data',
    paint: {
      'fill-color': getColorScale(geoLevel, isForecast, minVal, maxVal, isRenterDemand, isInventory) as any,
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

  // Labels for state level
  if (geoLevel === 'state' || geoLevel === 'national') {
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

    map.addLayer({
      id: 'geo-labels',
      type: 'symbol',
      source: 'geo-data',
      layout: {
        'text-field': [
          'format',
          ['get', 'name'], { 'font-scale': 0.85, 'text-font': ['literal', ['DIN Pro Medium', 'Arial Unicode MS Regular']] },
          '\n', {},
          valueFormat,
          { 'font-scale': 0.75, 'text-font': ['literal', ['DIN Pro Regular', 'Arial Unicode MS Regular']] },
        ],
        'text-size': 11,
        'text-anchor': 'center',
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#1a1a2e',
        'text-halo-color': 'rgba(255, 255, 255, 0.9)',
        'text-halo-width': 1.5,
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

      const { displayValue, valueColor } = formatDisplayValue(value, metricFormat);
      const horizonLabel = forecastHorizon === '1m' ? '1-month' : forecastHorizon === '3m' ? '3-month' : '12-month';
      const isForecast = metricFormat === 'percent';

      popup.current
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family: 'Google Sans', Roboto, sans-serif; padding: 8px 12px;">
            <div style="font-weight: 500; font-size: 14px; color: #1a1a2e;">${name}</div>
            <div style="font-size: 20px; font-weight: 600; color: ${valueColor};">${displayValue}</div>
            ${isForecast ? `<div style="font-size: 11px; color: #6b7280;">${horizonLabel} forecast</div>` : ''}
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

function formatDisplayValue(
  value: number | null,
  metricFormat: MetricFormat
): { displayValue: string; valueColor: string } {
  let displayValue: string;
  let valueColor = '#6750a4';

  // Handle null (no data) case
  if (value === null || value === undefined) {
    return { displayValue: 'No data', valueColor: '#6b7280' };
  }

  switch (metricFormat) {
    case 'percent':
      // For percentages, 0 is a valid value (no change predicted)
      const sign = value > 0 ? '+' : '';
      displayValue = `${sign}${value.toFixed(1)}%`;
      valueColor = value > 0 ? '#b91c1c' : value < 0 ? '#3b82f6' : '#6b7280';
      break;
    case 'index':
      displayValue = value > 0 ? value.toFixed(0) : 'No data';
      valueColor = value >= 100 ? '#b91c1c' : '#3b82f6';
      break;
    case 'number':
      displayValue = value >= 0 ? value.toLocaleString('en-US') : 'No data';
      break;
    case 'days':
      displayValue = value >= 0 ? `${value.toLocaleString('en-US')} days` : 'No data';
      break;
    case 'currency':
    default:
      displayValue = value > 0
        ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
        : 'No data';
      break;
  }

  return { displayValue, valueColor };
}
