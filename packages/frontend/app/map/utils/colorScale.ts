import { COLOR_SCALE, NO_DATA_COLOR } from './metricUtils';

// Mapbox expression type - can contain strings, numbers, booleans, null, and nested arrays
type MapboxExpressionValue = string | number | boolean | null | MapboxExpressionValue[];
type MapboxColorExpression = MapboxExpressionValue[];

/**
 * Get color scale for map visualization
 *
 * Uses dynamic min/max values from calculateValueRange() to ensure
 * the map colors match the legend display exactly.
 *
 * Color scale: violet -> blue -> green -> yellow -> orange -> red -> dark red
 */
export function getColorScale(
  min: number,
  max: number
): MapboxColorExpression {
  // Handle single value case (e.g., national level with 1 data point)
  // Mapbox interpolate requires strictly ascending values
  if (min === max || max - min < 0.001) {
    // Return middle color for single value
    return [
      'case',
      ['==', ['get', 'value'], null], NO_DATA_COLOR,
      COLOR_SCALE[3] // Use middle color (yellow-green)
    ];
  }

  // Calculate step size for 7-color interpolation
  const range = max - min;
  const step = range / 6;

  return [
    'case',
    // Handle null/undefined as no data
    ['==', ['get', 'value'], null], NO_DATA_COLOR,
    // Interpolate colors based on value
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
