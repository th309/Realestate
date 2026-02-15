import * as d3 from 'd3';
import { CHART_COLORS, FormatType, getFormatter } from './scales';

interface AxisConfig {
  scale: d3.AxisScale<d3.AxisDomain>;
  tickCount?: number;
  tickFormat?: (value: d3.AxisDomain) => string;
  formatType?: FormatType;
  label?: string;
  gridLines?: boolean;
}

/**
 * For log scales, d3's `.ticks(n)` is a weak hint and often produces
 * dozens of ticks (1, 2, 3, 5 at every order of magnitude).
 * This helper generates clean "1-2-5" ticks capped at `maxTicks`.
 */
function logTickValues(scale: d3.AxisScale<d3.AxisDomain>, maxTicks: number): number[] {
  const domain = (scale as any).domain() as [number, number];
  const lo = Math.max(domain[0], 1e-10);
  const hi = Math.max(domain[1], lo * 1.01);

  const logLo = Math.floor(Math.log10(lo));
  const logHi = Math.ceil(Math.log10(hi));

  // Generate candidate ticks: 1, 2, 5 × each power of 10
  const candidates: number[] = [];
  for (let p = logLo; p <= logHi; p++) {
    const base = Math.pow(10, p);
    for (const m of [1, 2, 5]) {
      const v = base * m;
      if (v >= lo * 0.99 && v <= hi * 1.01) candidates.push(v);
    }
  }

  if (candidates.length <= maxTicks) return candidates;

  // Too many — thin to powers of 10 only
  const powersOf10 = candidates.filter(v => {
    const l = Math.log10(v);
    return Math.abs(l - Math.round(l)) < 0.001;
  });
  if (powersOf10.length <= maxTicks && powersOf10.length >= 2) return powersOf10;

  // Still too many — evenly sample
  const step = Math.max(1, Math.floor(candidates.length / maxTicks));
  return candidates.filter((_, i) => i % step === 0).slice(0, maxTicks);
}

/** Detect if the underlying scale is logarithmic */
function isLogScale(scale: d3.AxisScale<d3.AxisDomain>): boolean {
  // d3.scaleLog has a `.base()` method that linear/other scales lack
  return typeof (scale as any).base === 'function';
}

// Create X axis generator
export function createXAxis(config: AxisConfig): d3.Axis<d3.AxisDomain> {
  const { scale, tickCount = 6, tickFormat, formatType, gridLines } = config;

  const axis = d3.axisBottom(scale);

  if (isLogScale(scale)) {
    axis.tickValues(logTickValues(scale, tickCount) as d3.AxisDomain[]);
  } else if (tickCount) {
    axis.ticks(tickCount);
  }

  if (tickFormat) {
    axis.tickFormat(tickFormat as any);
  } else if (formatType) {
    axis.tickFormat(getFormatter(formatType) as any);
  }

  if (gridLines) {
    axis.tickSize(-1); // Will be overridden when rendering
  }

  return axis;
}

// Create Y axis generator
export function createYAxis(config: AxisConfig): d3.Axis<d3.AxisDomain> {
  const { scale, tickCount = 5, tickFormat, formatType, gridLines } = config;

  const axis = d3.axisLeft(scale);

  if (isLogScale(scale)) {
    axis.tickValues(logTickValues(scale, tickCount) as d3.AxisDomain[]);
  } else if (tickCount) {
    axis.ticks(tickCount);
  }

  if (tickFormat) {
    axis.tickFormat(tickFormat as any);
  } else if (formatType) {
    axis.tickFormat(getFormatter(formatType) as any);
  }

  if (gridLines) {
    axis.tickSize(-1); // Will be overridden when rendering
  }

  return axis;
}

// Render X axis to SVG
export function renderXAxis(
  selection: d3.Selection<SVGGElement, unknown, null, undefined>,
  axis: d3.Axis<d3.AxisDomain>,
  config: {
    height: number;
    gridLines?: boolean;
    gridHeight?: number;
    label?: string;
    labelOffset?: number;
  }
) {
  const { height, gridLines, gridHeight, label, labelOffset = 35 } = config;

  // Clear existing
  selection.selectAll('*').remove();

  // Position axis at bottom
  selection.attr('transform', `translate(0,${height})`);

  // Render axis
  selection.call(axis);

  // Style axis
  selection
    .selectAll('line, path')
    .attr('stroke', CHART_COLORS.outlineVariant);

  selection
    .selectAll('text')
    .attr('fill', CHART_COLORS.onSurfaceVariant)
    .attr('font-size', '11px');

  // Add grid lines
  if (gridLines && gridHeight) {
    selection
      .selectAll('.tick line')
      .clone()
      .attr('y2', -gridHeight)
      .attr('stroke', CHART_COLORS.outlineVariant)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-dasharray', '2,2');
  }

  // Add label
  if (label) {
    selection
      .append('text')
      .attr('x', selection.node()?.getBoundingClientRect().width ?? 0 / 2)
      .attr('y', labelOffset)
      .attr('fill', CHART_COLORS.onSurfaceVariant)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .text(label);
  }
}

// Render Y axis to SVG
export function renderYAxis(
  selection: d3.Selection<SVGGElement, unknown, null, undefined>,
  axis: d3.Axis<d3.AxisDomain>,
  config: {
    gridLines?: boolean;
    gridWidth?: number;
    label?: string;
    labelOffset?: number;
  }
) {
  const { gridLines, gridWidth, label, labelOffset = -40 } = config;

  // Clear existing
  selection.selectAll('*').remove();

  // Render axis
  selection.call(axis);

  // Style axis
  selection
    .selectAll('line, path')
    .attr('stroke', CHART_COLORS.outlineVariant);

  selection
    .selectAll('text')
    .attr('fill', CHART_COLORS.onSurfaceVariant)
    .attr('font-size', '11px');

  // Add grid lines
  if (gridLines && gridWidth) {
    selection
      .selectAll('.tick line')
      .clone()
      .attr('x2', gridWidth)
      .attr('stroke', CHART_COLORS.outlineVariant)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-dasharray', '2,2');
  }

  // Add label
  if (label) {
    selection
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', labelOffset)
      .attr('x', -((selection.node()?.getBoundingClientRect().height ?? 0) / 2))
      .attr('fill', CHART_COLORS.onSurfaceVariant)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .text(label);
  }
}

// Time axis with smart tick formatting
export function createTimeAxis(
  scale: d3.ScaleTime<number, number>,
  width: number
): d3.Axis<Date | d3.NumberValue> {
  const domain = scale.domain();
  const range = domain[1].getTime() - domain[0].getTime();
  const days = range / (1000 * 60 * 60 * 24);

  let tickFormat: d3.TimeLocaleObject['format'];
  let ticks: number;

  if (days <= 7) {
    // Week view: show days
    tickFormat = d3.timeFormat('%b %d') as any;
    ticks = Math.min(7, Math.floor(width / 80));
  } else if (days <= 90) {
    // Quarter view: show weeks
    tickFormat = d3.timeFormat('%b %d') as any;
    ticks = Math.min(12, Math.floor(width / 60));
  } else if (days <= 365) {
    // Year view: show months
    tickFormat = d3.timeFormat('%b') as any;
    ticks = Math.min(12, Math.floor(width / 50));
  } else {
    // Multi-year view: show years
    tickFormat = d3.timeFormat('%Y') as any;
    ticks = Math.min(10, Math.floor(width / 60));
  }

  return d3
    .axisBottom(scale)
    .ticks(ticks)
    .tickFormat(tickFormat as any);
}

// Create axis with custom breaks (for log scales, etc.)
export function createAxisWithBreaks(
  scale: d3.AxisScale<d3.AxisDomain>,
  breaks: number[],
  formatFn: (value: number) => string
): d3.Axis<d3.AxisDomain> {
  return d3
    .axisLeft(scale)
    .tickValues(breaks as d3.AxisDomain[])
    .tickFormat(formatFn as any);
}

// Margin configuration helper
export interface ChartMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const defaultMargins: ChartMargins = {
  top: 20,
  right: 20,
  bottom: 40,
  left: 50,
};

export function getChartDimensions(
  containerWidth: number,
  containerHeight: number,
  margins: Partial<ChartMargins> = {}
) {
  const m = { ...defaultMargins, ...margins };

  return {
    width: containerWidth - m.left - m.right,
    height: containerHeight - m.top - m.bottom,
    margins: m,
  };
}

// Axis animation helper
export function animateAxis(
  selection: d3.Selection<SVGGElement, unknown, null, undefined>,
  axis: d3.Axis<d3.AxisDomain>,
  duration: number = 300
) {
  selection.transition().duration(duration).call(axis);
}
