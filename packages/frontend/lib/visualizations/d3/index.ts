// D3.js Visualization Components
// Material Design 3 styled data visualizations

// Hooks
export {
  useD3,
  useResponsiveD3,
  useD3Zoom,
  useD3Brush,
  useD3Tooltip,
  D3Tooltip,
} from './hooks/useD3';

// Utilities
export {
  // Colors
  CHART_COLORS,
  sequentialScales,
  divergingScales,
  categoricalScale,
  createValueScale,

  // Scales
  createLinearScale,
  createTimeScale,
  createBandScale,
  createPointScale,
  createSizeScale,
  createPercentileScale,
  createQuantileScale,
  createThresholdScale,

  // Formatters
  formatters,
  getFormatter,
  type FormatType,
} from './utils/scales';

export {
  // Axes
  createXAxis,
  createYAxis,
  renderXAxis,
  renderYAxis,
  createTimeAxis,
  createAxisWithBreaks,
  animateAxis,

  // Layout
  getChartDimensions,
  defaultMargins,
  type ChartMargins,
} from './utils/axes';

// Chart Components
export { ScatterPlot, type ScatterDataPoint } from './ScatterPlot';
export { BoxPlot } from './BoxPlot';
export { Treemap } from './Treemap';
export { Heatmap } from './Heatmap';
export { CorrelationMatrix } from './CorrelationMatrix';
export { WaterfallChart } from './WaterfallChart';
export type { WaterfallBar, WaterfallChartProps } from './WaterfallChart';
export { HorizontalBarChart } from './HorizontalBarChart';
export type { BarEntry, BarRaceFrame, HorizontalBarChartProps } from './HorizontalBarChart';
export { RadarChart } from './RadarChart';
export type { RadarDataSet, RadarDimension, RadarChartProps } from './RadarChart';
export { PlaybackControls, type PlaybackControlsProps } from './PlaybackControls';
