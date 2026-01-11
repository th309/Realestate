import type { GeoLevel } from '../types';

type MapboxColorExpression = (string | number)[];

/**
 * Get color scale for map visualization
 * Uses cool-to-warm scale (blue -> cyan -> green -> yellow -> orange -> red)
 */
export function getColorScale(
  level: GeoLevel,
  isForecast: boolean = false,
  min?: number,
  max?: number,
  isRenterDemand: boolean = false
): MapboxColorExpression {
  // Forecast uses percentage scale - cool to warm (blue = decline, red = growth)
  if (isForecast) {
    return [
      'interpolate', ['linear'], ['get', 'value'],
      -5, '#3b82f6',    // Blue (cool - decline)
      -2, '#06b6d4',    // Cyan
      0, '#10b981',     // Green (flat)
      2, '#fbbf24',     // Yellow
      5, '#f97316',     // Orange
      10, '#b91c1c',    // Dark red (hot - strong growth)
    ];
  }

  // ZORDI (Renter Demand) - 7-color cool-to-warm scale, yellow at baseline 100
  if (isRenterDemand) {
    // 0 = no demand (cool/blue), 100 = baseline (yellow), >100 = high demand (warm/red)
    return [
      'interpolate', ['linear'], ['get', 'value'],
      0, '#3b82f6',          // Blue (cool - no demand)
      33, '#06b6d4',         // Cyan
      67, '#10b981',         // Green
      100, '#fbbf24',        // Yellow (baseline)
      133, '#f97316',        // Orange
      167, '#ef4444',        // Red
      200, '#b91c1c',        // Dark red (hot - high demand)
    ];
  }

  // Dynamic scale if min/max provided (used for Rent Index - cool to warm)
  if (min !== undefined && max !== undefined) {
    const step = (max - min) / 6;
    return [
      'interpolate', ['linear'], ['get', 'value'],
      min, '#3b82f6',              // Blue (cool - lowest)
      min + step, '#06b6d4',       // Cyan
      min + step * 2, '#10b981',   // Green
      min + step * 3, '#fbbf24',   // Yellow
      min + step * 4, '#f97316',   // Orange
      min + step * 5, '#ef4444',   // Red
      max, '#b91c1c',              // Dark red (hot - highest)
    ];
  }

  // Adjust scale based on geography level for home values - cool to warm
  if (level === 'zip' || level === 'county') {
    return [
      'interpolate', ['linear'], ['get', 'value'],
      0, '#3b82f6',          // Blue (cool - lowest)
      100000, '#06b6d4',     // Cyan
      200000, '#10b981',     // Green
      350000, '#fbbf24',     // Yellow
      500000, '#f97316',     // Orange
      650000, '#ef4444',     // Red
      800000, '#b91c1c',     // Dark red (hot - highest)
    ];
  }

  // State/Metro/National level scale
  return [
    'interpolate', ['linear'], ['get', 'value'],
    100000, '#3b82f6',       // Blue (cool - lowest)
    200000, '#06b6d4',       // Cyan
    350000, '#10b981',       // Green
    500000, '#fbbf24',       // Yellow
    650000, '#f97316',       // Orange
    800000, '#ef4444',       // Red
    1000000, '#b91c1c',      // Dark red (hot - highest)
  ];
}

// Color scale colors for legend display
export const COLOR_SCALE_STOPS = {
  forecast: [
    { value: -5, color: '#3b82f6', label: '-5%' },
    { value: 0, color: '#10b981', label: '0%' },
    { value: 5, color: '#f97316', label: '+5%' },
    { value: 10, color: '#b91c1c', label: '+10%' },
  ],
  renterDemand: [
    { value: 0, color: '#3b82f6', label: '0' },
    { value: 100, color: '#fbbf24', label: '100' },
    { value: 200, color: '#b91c1c', label: '200+' },
  ],
  homeValue: [
    { value: 100000, color: '#3b82f6', label: '$100K' },
    { value: 350000, color: '#10b981', label: '$350K' },
    { value: 500000, color: '#fbbf24', label: '$500K' },
    { value: 800000, color: '#ef4444', label: '$800K' },
    { value: 1000000, color: '#b91c1c', label: '$1M+' },
  ],
};
