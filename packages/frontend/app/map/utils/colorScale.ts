import type { GeoLevel } from '../types';
import { COLOR_SCALE, NO_DATA_COLOR } from './metricUtils';

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
  // Forecast/Percent uses dynamic min/max scale - cool to warm (violet = min, red = max)
  if (isForecast) {
    // Use provided min/max or default to -5 to +10
    const minValue = min !== undefined ? min : -5;
    const maxValue = max !== undefined ? max : 10;
    const range = maxValue - minValue;
    const step = range / 5;

    return [
      'case',
      ['==', ['get', 'value'], null], NO_DATA_COLOR,
      [
        'interpolate', ['linear'], ['get', 'value'],
        minValue, COLOR_SCALE[0],
        minValue + step, COLOR_SCALE[1],
        minValue + step * 2, COLOR_SCALE[2],
        minValue + step * 3, COLOR_SCALE[3],
        minValue + step * 4, COLOR_SCALE[4],
        maxValue, COLOR_SCALE[6],
      ]
    ];
  }

  // ZORDI (Renter Demand) - 7-color cool-to-warm scale, yellow at baseline 100
  if (isRenterDemand) {
    // 0 = no demand (cool/violet), 100 = baseline (yellow), >100 = high demand (warm/red)
    return [
      'interpolate', ['linear'], ['get', 'value'],
      0, COLOR_SCALE[0],
      33, COLOR_SCALE[1],
      67, COLOR_SCALE[2],
      100, COLOR_SCALE[3],
      133, COLOR_SCALE[4],
      167, COLOR_SCALE[5],
      200, COLOR_SCALE[6],
    ];
  }

  // Inventory uses 0-max scale (count-based, not currency)
  if (isInventory && max !== undefined) {
    const step = max / 6;
    return [
      'case',
      ['==', ['get', 'value'], null], NO_DATA_COLOR,
      [
        'interpolate', ['linear'], ['get', 'value'],
        0, COLOR_SCALE[0],
        step, COLOR_SCALE[1],
        step * 2, COLOR_SCALE[2],
        step * 3, COLOR_SCALE[3],
        step * 4, COLOR_SCALE[4],
        step * 5, COLOR_SCALE[5],
        max, COLOR_SCALE[6],
      ]
    ];
  }

  // Dynamic scale if min/max provided (used for all metrics with dynamic range)
  if (min !== undefined && max !== undefined) {
    const step = (max - min) / 6;
    return [
      'case',
      ['==', ['get', 'value'], null], NO_DATA_COLOR,
      ['==', ['get', 'value'], 0], NO_DATA_COLOR,
      ['<=', ['get', 'value'], 0], NO_DATA_COLOR,
      [
        'interpolate', ['linear'], ['get', 'value'],
        min, COLOR_SCALE[0],
        min + step, COLOR_SCALE[1],
        min + step * 2, COLOR_SCALE[2],
        min + step * 3, COLOR_SCALE[3],
        min + step * 4, COLOR_SCALE[4],
        min + step * 5, COLOR_SCALE[5],
        max, COLOR_SCALE[6],
      ]
    ];
  }

  // Adjust scale based on geography level for home values - cool to warm
  // Use case expression to handle null/0 values (no data) as transparent
  if (level === 'zip' || level === 'county') {
    return [
      'case',
      ['==', ['get', 'value'], null], NO_DATA_COLOR,
      ['==', ['get', 'value'], 0], NO_DATA_COLOR,
      ['<=', ['get', 'value'], 0], NO_DATA_COLOR,
      [
        'interpolate', ['linear'], ['get', 'value'],
        1, COLOR_SCALE[0],
        100000, COLOR_SCALE[1],
        200000, COLOR_SCALE[2],
        350000, COLOR_SCALE[3],
        500000, COLOR_SCALE[4],
        650000, COLOR_SCALE[5],
        800000, COLOR_SCALE[6],
      ]
    ];
  }

  // State/Metro/National level scale - also handle null/0 values
  return [
    'case',
    ['==', ['get', 'value'], null], NO_DATA_COLOR,
    ['==', ['get', 'value'], 0], NO_DATA_COLOR,
    ['<=', ['get', 'value'], 0], NO_DATA_COLOR,
    [
      'interpolate', ['linear'], ['get', 'value'],
      1, COLOR_SCALE[0],
      200000, COLOR_SCALE[1],
      350000, COLOR_SCALE[2],
      500000, COLOR_SCALE[3],
      650000, COLOR_SCALE[4],
      800000, COLOR_SCALE[5],
      1000000, COLOR_SCALE[6],
    ]
  ];
}

// Color scale colors for legend display (uses shared COLOR_SCALE)
export const COLOR_SCALE_STOPS = {
  forecast: [
    { value: -5, color: COLOR_SCALE[0], label: '-5%' },
    { value: 0, color: COLOR_SCALE[2], label: '0%' },
    { value: 5, color: COLOR_SCALE[4], label: '+5%' },
    { value: 10, color: COLOR_SCALE[6], label: '+10%' },
  ],
  renterDemand: [
    { value: 0, color: COLOR_SCALE[0], label: '0' },
    { value: 100, color: COLOR_SCALE[3], label: '100' },
    { value: 200, color: COLOR_SCALE[6], label: '200+' },
  ],
  homeValue: [
    { value: 100000, color: COLOR_SCALE[0], label: '$100K' },
    { value: 350000, color: COLOR_SCALE[2], label: '$350K' },
    { value: 500000, color: COLOR_SCALE[3], label: '$500K' },
    { value: 800000, color: COLOR_SCALE[5], label: '$800K' },
    { value: 1000000, color: COLOR_SCALE[6], label: '$1M+' },
  ],
};
