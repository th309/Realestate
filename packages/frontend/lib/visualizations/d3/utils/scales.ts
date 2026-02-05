import * as d3 from 'd3';

// M3 Chart Color Palette
export const CHART_COLORS = {
  // Primary series
  primary: '#6750a4',
  onPrimary: '#ffffff',
  primaryContainer: '#eaddff',

  // Comparison series
  comparison: '#0891b2', // Cyan/Teal
  comparisonLight: '#67e8f9',

  // Baseline series
  baseline: '#ea580c', // Orange
  baselineLight: '#fdba74',

  // Additional series for multi-series charts
  series: [
    '#6750a4', // Purple (primary)
    '#0891b2', // Cyan
    '#ea580c', // Orange
    '#16a34a', // Green
    '#dc2626', // Red
    '#7c3aed', // Violet
    '#0d9488', // Teal
    '#ca8a04', // Yellow
  ],

  // Semantic colors
  positive: '#16a34a',
  negative: '#dc2626',
  neutral: '#6b7280',

  // Surface colors
  surface: '#fef7ff',
  surfaceContainer: '#f3edf7',
  outline: '#79747e',
  outlineVariant: '#cac4d0',
  onSurface: '#1d1b20',
  onSurfaceVariant: '#49454f',
};

// Sequential color scales (for heatmaps, choropleths)
export const sequentialScales = {
  // Purple sequential
  purple: d3.scaleSequential(d3.interpolatePurples),

  // Blue-Purple sequential
  bluePurple: d3.scaleSequential(d3.interpolateBuPu),

  // Cool (blue to green)
  cool: d3.scaleSequential(d3.interpolateCool),

  // Warm (orange to red)
  warm: d3.scaleSequential(d3.interpolateYlOrRd),

  // Viridis (perceptually uniform)
  viridis: d3.scaleSequential(d3.interpolateViridis),
};

// Diverging color scales (for positive/negative values)
export const divergingScales = {
  // Red-White-Blue
  redBlue: d3.scaleDiverging(d3.interpolateRdBu),

  // Red-White-Green
  redGreen: d3.scaleDiverging(d3.interpolateRdYlGn),

  // Purple-White-Green
  purpleGreen: d3.scaleDiverging(d3.interpolatePRGn),

  // Brown-White-Teal
  brownTeal: d3.scaleDiverging(d3.interpolateBrBG),
};

// Categorical color scale
export const categoricalScale = (domain: string[]) =>
  d3.scaleOrdinal<string>().domain(domain).range(CHART_COLORS.series);

// Create a value color scale for numeric data
export function createValueScale(
  domain: [number, number],
  type: 'sequential' | 'diverging' = 'sequential',
  colorScheme: keyof typeof sequentialScales | keyof typeof divergingScales = 'purple'
): d3.ScaleSequential<string, never> | d3.ScaleDiverging<string, never> {
  if (type === 'diverging') {
    const scale = divergingScales[colorScheme as keyof typeof divergingScales];
    return scale.domain([domain[0], (domain[0] + domain[1]) / 2, domain[1]]);
  }

  const scale = sequentialScales[colorScheme as keyof typeof sequentialScales];
  return scale.domain(domain);
}

// Linear scale with padding
export function createLinearScale(
  domain: [number, number],
  range: [number, number],
  padding: number = 0.05
): d3.ScaleLinear<number, number> {
  const extent = domain[1] - domain[0];
  const paddedDomain: [number, number] = [
    domain[0] - extent * padding,
    domain[1] + extent * padding,
  ];

  return d3.scaleLinear().domain(paddedDomain).range(range).nice();
}

// Time scale for date-based data
export function createTimeScale(
  domain: [Date, Date],
  range: [number, number]
): d3.ScaleTime<number, number> {
  return d3.scaleTime().domain(domain).range(range).nice();
}

// Band scale for categorical data
export function createBandScale(
  domain: string[],
  range: [number, number],
  padding: number = 0.2
): d3.ScaleBand<string> {
  return d3.scaleBand().domain(domain).range(range).padding(padding);
}

// Point scale for scatter-like categorical placement
export function createPointScale(
  domain: string[],
  range: [number, number],
  padding: number = 0.5
): d3.ScalePoint<string> {
  return d3.scalePoint().domain(domain).range(range).padding(padding);
}

// Size scale (for bubble charts)
export function createSizeScale(
  domain: [number, number],
  range: [number, number] = [4, 40]
): d3.ScalePower<number, number> {
  return d3.scaleSqrt<number, number>().domain(domain).range(range);
}

// Percentile scale (maps values to percentiles)
export function createPercentileScale(
  data: number[]
): (value: number) => number {
  const sorted = [...data].sort((a, b) => a - b);
  return (value: number) => {
    const index = d3.bisectLeft(sorted, value);
    return index / sorted.length;
  };
}

// Quantile scale (for quartile-based coloring)
export function createQuantileScale<T>(
  data: number[],
  range: T[]
): d3.ScaleQuantile<T> {
  return d3.scaleQuantile<T>().domain(data).range(range);
}

// Threshold scale (for custom breakpoints)
export function createThresholdScale<T>(
  thresholds: number[],
  range: T[]
): d3.ScaleThreshold<number, T> {
  return d3.scaleThreshold<number, T>().domain(thresholds).range(range);
}

// Format helpers
export const formatters = {
  currency: (value: number) =>
    value >= 1e6
      ? `$${(value / 1e6).toFixed(1)}M`
      : value >= 1e3
      ? `$${(value / 1e3).toFixed(0)}K`
      : `$${value.toFixed(0)}`,

  percent: (value: number) => `${(value * 100).toFixed(1)}%`,

  percentAbs: (value: number) => `${value.toFixed(1)}%`,

  number: (value: number) =>
    value >= 1e6
      ? `${(value / 1e6).toFixed(1)}M`
      : value >= 1e3
      ? `${(value / 1e3).toFixed(1)}K`
      : value.toFixed(1),

  integer: (value: number) => Math.round(value).toLocaleString(),

  days: (value: number) => `${Math.round(value)}d`,

  correlation: (value: number) => value.toFixed(2),
};

export type FormatType = keyof typeof formatters;

export function getFormatter(type: FormatType) {
  return formatters[type];
}
