import type { GeoLevel } from '../types';

// Mapbox expression type - can contain strings, numbers, booleans, null, and nested arrays
type MapboxExpressionValue = string | number | boolean | null | MapboxExpressionValue[];
type MapboxColorExpression = MapboxExpressionValue[];

/**
 * Get color scale for map visualization
 * Uses cool-to-warm scale (violet -> blue -> green -> yellow -> orange -> red)
 * Colors chosen for maximum visual distinction
 */
export function getColorScale(
  level: GeoLevel,
  isForecast: boolean = false,
  min?: number,
  max?: number,
  isRenterDemand: boolean = false,
  isInventory: boolean = false
): MapboxColorExpression {
  // Forecast/Percent uses dynamic min/max scale - cool to warm (blue = min, red = max)
  if (isForecast) {
    // Use provided min/max or default to -5 to +10
    const minValue = min !== undefined ? min : -5;
    const maxValue = max !== undefined ? max : 10;
    const range = maxValue - minValue;
    const step = range / 5;

    return [
      'case',
      ['==', ['get', 'value'], null], 'rgba(200, 200, 200, 0.3)',  // No data - light gray
      [
        'interpolate', ['linear'], ['get', 'value'],
        minValue, '#7c3aed',              // Violet (cool - min growth)
        minValue + step, '#3b82f6',       // Blue
        minValue + step * 2, '#22c55e',   // Green
        minValue + step * 3, '#eab308',   // Yellow
        minValue + step * 4, '#f97316',   // Orange
        maxValue, '#b91c1c',              // Dark red (hot - max growth)
      ]
    ];
  }

  // ZORDI (Renter Demand) - 7-color cool-to-warm scale, yellow at baseline 100
  if (isRenterDemand) {
    // 0 = no demand (cool/violet), 100 = baseline (yellow), >100 = high demand (warm/red)
    return [
      'interpolate', ['linear'], ['get', 'value'],
      0, '#7c3aed',          // Violet (cool - no demand)
      33, '#3b82f6',         // Blue
      67, '#22c55e',         // Green
      100, '#eab308',        // Yellow (baseline)
      133, '#f97316',        // Orange
      167, '#ef4444',        // Red
      200, '#b91c1c',        // Dark red (hot - high demand)
    ];
  }

  // Inventory uses 0-max scale (count-based, not currency)
  if (isInventory && max !== undefined) {
    const step = max / 6;
    return [
      'case',
      ['==', ['get', 'value'], null], 'rgba(200, 200, 200, 0.3)',  // No data - light gray
      [
        'interpolate', ['linear'], ['get', 'value'],
        0, '#7c3aed',              // Violet (cool - lowest)
        step, '#3b82f6',           // Blue
        step * 2, '#22c55e',       // Green
        step * 3, '#eab308',       // Yellow
        step * 4, '#f97316',       // Orange
        step * 5, '#ef4444',       // Red
        max, '#b91c1c',            // Dark red (hot - highest)
      ]
    ];
  }

  // Dynamic scale if min/max provided (used for all metrics with dynamic range)
  if (min !== undefined && max !== undefined) {
    const step = (max - min) / 6;
    return [
      'case',
      ['==', ['get', 'value'], null], 'rgba(200, 200, 200, 0.3)',  // No data - light gray
      ['==', ['get', 'value'], 0], 'rgba(200, 200, 200, 0.3)',     // Zero value - light gray
      ['<=', ['get', 'value'], 0], 'rgba(200, 200, 200, 0.3)',     // Negative or zero - light gray
      [
        'interpolate', ['linear'], ['get', 'value'],
        min, '#7c3aed',              // Violet (cool - lowest)
        min + step, '#3b82f6',       // Blue
        min + step * 2, '#22c55e',   // Green
        min + step * 3, '#eab308',   // Yellow
        min + step * 4, '#f97316',   // Orange
        min + step * 5, '#ef4444',   // Red
        max, '#b91c1c',              // Dark red (hot - highest)
      ]
    ];
  }

  // Adjust scale based on geography level for home values - cool to warm
  // Use case expression to handle null/0 values (no data) as transparent
  if (level === 'zip' || level === 'county') {
    return [
      'case',
      ['==', ['get', 'value'], null], 'rgba(200, 200, 200, 0.3)',  // No data - light gray
      ['==', ['get', 'value'], 0], 'rgba(200, 200, 200, 0.3)',     // Zero value - light gray
      ['<=', ['get', 'value'], 0], 'rgba(200, 200, 200, 0.3)',     // Negative or zero - light gray
      [
        'interpolate', ['linear'], ['get', 'value'],
        1, '#7c3aed',              // Violet (cool - lowest, but has data)
        100000, '#3b82f6',         // Blue
        200000, '#22c55e',         // Green
        350000, '#eab308',         // Yellow
        500000, '#f97316',         // Orange
        650000, '#ef4444',         // Red
        800000, '#b91c1c',         // Dark red (hot - highest)
      ]
    ];
  }

  // State/Metro/National level scale - also handle null/0 values
  return [
    'case',
    ['==', ['get', 'value'], null], 'rgba(200, 200, 200, 0.3)',
    ['==', ['get', 'value'], 0], 'rgba(200, 200, 200, 0.3)',
    ['<=', ['get', 'value'], 0], 'rgba(200, 200, 200, 0.3)',
    [
      'interpolate', ['linear'], ['get', 'value'],
      1, '#7c3aed',            // Violet (cool - lowest, but has data)
      200000, '#3b82f6',       // Blue
      350000, '#22c55e',       // Green
      500000, '#eab308',       // Yellow
      650000, '#f97316',       // Orange
      800000, '#ef4444',       // Red
      1000000, '#b91c1c',      // Dark red (hot - highest)
    ]
  ];
}

// Color scale colors for legend display
export const COLOR_SCALE_STOPS = {
  forecast: [
    { value: -5, color: '#7c3aed', label: '-5%' },
    { value: 0, color: '#22c55e', label: '0%' },
    { value: 5, color: '#f97316', label: '+5%' },
    { value: 10, color: '#b91c1c', label: '+10%' },
  ],
  renterDemand: [
    { value: 0, color: '#7c3aed', label: '0' },
    { value: 100, color: '#eab308', label: '100' },
    { value: 200, color: '#b91c1c', label: '200+' },
  ],
  homeValue: [
    { value: 100000, color: '#7c3aed', label: '$100K' },
    { value: 350000, color: '#22c55e', label: '$350K' },
    { value: 500000, color: '#eab308', label: '$500K' },
    { value: 800000, color: '#ef4444', label: '$800K' },
    { value: 1000000, color: '#b91c1c', label: '$1M+' },
  ],
};
