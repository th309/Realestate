'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useD3Tooltip, D3Tooltip, useResponsiveD3 } from './hooks/useD3';
import {
  CHART_COLORS,
  createSizeScale,
  categoricalScale,
  FormatType,
  getFormatter,
} from './utils/scales';
import { animateAxis, createXAxis, createYAxis } from './utils/axes';
import { PlaybackControls } from './PlaybackControls';

export interface ScatterDataPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  size?: number;
  color?: number;
  category?: string;
  tooltip?: React.ReactNode;
}

export type ScaleType = 'linear' | 'log';

/**
 * Compute a robust axis domain that excludes extreme outliers.
 * Uses the IQR method: domain is [Q1 - 1.5*IQR, Q3 + 1.5*IQR],
 * expanded slightly by 5% padding. Falls back to raw extent if
 * there are fewer than 4 values or no outliers detected.
 *
 * If all raw values are ≥ 0, the lower bound is clamped to 0
 * so the axis never shows nonsensical negatives (e.g. -10 days on market).
 */
function robustDomain(values: number[]): [number, number] {
  const allNonNeg = values.every(v => v >= 0);

  if (values.length < 4) {
    const ext = d3.extent(values) as [number, number];
    const p = (ext[1] - ext[0]) * 0.05 || 1;
    let lo = ext[0] - p;
    if (allNonNeg && lo < 0) lo = 0;
    return [lo, ext[1] + p];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = d3.quantile(sorted, 0.25)!;
  const q3 = d3.quantile(sorted, 0.75)!;
  const iqr = q3 - q1;

  // If IQR is 0 (all values roughly equal), fall back to raw extent
  if (iqr === 0) {
    const ext = d3.extent(sorted) as [number, number];
    const p = (ext[1] - ext[0]) * 0.05 || 1;
    let lo = ext[0] - p;
    if (allNonNeg && lo < 0) lo = 0;
    return [lo, ext[1] + p];
  }

  const fence = 1.5 * iqr;
  // Clip to the range of non-outlier data
  let lo = Math.max(sorted[0], q1 - fence);
  const hi = Math.min(sorted[sorted.length - 1], q3 + fence);
  const padding = (hi - lo) * 0.05;
  lo = lo - padding;
  if (allNonNeg && lo < 0) lo = 0;
  return [lo, hi + padding];
}

const QUARTILE_COLORS = ['#0891b2', '#3b82f6', '#f59e0b', '#f97316'] as const;

/**
 * Compute label offsets that keep the text readable even when dots
 * are near the chart edges. Flips the label to the left when the dot
 * is close to the right edge, and below the dot near the top edge.
 */
function labelOffset(
  dotX: number, dotY: number,
  estWidth: number,
  chartW: number, chartH: number,
): { dx: number; dy: number; anchor: 'start' | 'end' } {
  // Horizontal: default to right of dot; flip left if it would overflow
  const rightRoom = chartW - dotX;
  const leftRoom = dotX;
  let dx: number;
  let anchor: 'start' | 'end';
  if (rightRoom < estWidth + 16) {
    // Not enough room to the right — place left of dot
    dx = -10;
    anchor = 'end';
  } else {
    dx = 10;
    anchor = 'start';
  }

  // Vertical: default to above dot; flip below if near top edge
  const dy = dotY < 18 ? 14 : -6;

  return { dx, dy, anchor };
}

interface ScatterPlotProps {
  data: ScatterDataPoint[];
  xLabel?: string;
  yLabel?: string;
  xFormat?: FormatType;
  yFormat?: FormatType;
  xScaleType?: ScaleType;
  yScaleType?: ScaleType;
  showRegression?: boolean;
  showQuadrants?: boolean;
  quadrantLabels?: {
    topLeft?: string;
    topRight?: string;
    bottomLeft?: string;
    bottomRight?: string;
  };
  colorByCategory?: boolean;
  sizeByValue?: boolean;
  height?: number;
  className?: string;
  onPointClick?: (point: ScatterDataPoint) => void;
  /** Race mode frames — if provided, enables time animation */
  raceFrames?: { date: string; points: ScatterDataPoint[] }[];
  /** Auto-play on mount (default false) */
  autoPlay?: boolean;
  /** Ms per frame (default 800) */
  playbackSpeed?: number;
  /** Called when frame changes */
  onFrameChange?: (frameIndex: number, date: string) => void;
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({
  data,
  xLabel,
  yLabel,
  xFormat = 'number',
  yFormat = 'number',
  xScaleType = 'linear',
  yScaleType = 'linear',
  showRegression = false,
  showQuadrants = false,
  quadrantLabels,
  colorByCategory = true,
  sizeByValue = true,
  height = 400,
  className = '',
  onPointClick,
  raceFrames,
  autoPlay = false,
  playbackSpeed = 800,
  onFrameChange,
}) => {
  const { containerRef, width, height: responsiveHeight } = useResponsiveD3<HTMLDivElement>(16 / 10, height, true);
  const { tooltip, showTooltip, hideTooltip, moveTooltip } = useD3Tooltip();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  // Store tooltip functions in refs so D3 event handlers always have the latest
  const showTooltipRef = useRef(showTooltip);
  showTooltipRef.current = showTooltip;
  const hideTooltipRef = useRef(hideTooltip);
  hideTooltipRef.current = hideTooltip;
  const moveTooltipRef = useRef(moveTooltip);
  moveTooltipRef.current = moveTooltip;

  // Store onPointClick in a ref
  const onPointClickRef = useRef(onPointClick);
  onPointClickRef.current = onPointClick;

  // ── Race mode state ──
  const isRaceMode = Boolean(raceFrames && raceFrames.length > 0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [speed, setSpeed] = useState(playbackSpeed);
  const [currentDate, setCurrentDate] = useState(raceFrames?.[0]?.date ?? '');
  const frameRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const renderFrameRef = useRef<(idx: number) => void>(undefined);
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  // Sync autoPlay prop → isPlaying state when race mode activates.
  // Start at the LAST frame (most recent data) so the initial view matches the static scatter.
  useEffect(() => {
    if (isRaceMode && raceFrames && raceFrames.length > 0) {
      const lastIdx = raceFrames.length - 1;
      frameRef.current = lastIdx;
      setCurrentFrame(lastIdx);
      setCurrentDate(raceFrames[lastIdx].date);
      if (autoPlay) setIsPlaying(true);
    }
    if (!isRaceMode) {
      setIsPlaying(false);
      frameRef.current = 0;
      setCurrentFrame(0);
    }
  }, [isRaceMode, autoPlay, raceFrames]);

  // Margins
  const margins = useMemo(() => ({
    left: 90,
    right: 30,
    top: 20,
    bottom: 60,
  }), []);

  const playbackControlsHeight = isRaceMode ? 44 : 0;
  const effectiveHeight = (responsiveHeight || height) - playbackControlsHeight;
  const chartWidth = (width || 600) - margins.left - margins.right;
  const chartHeight = effectiveHeight - margins.top - margins.bottom;

  // Calculate base scales
  const baseScales = useMemo(() => {
    if (data.length === 0) return null;

    const xExtent = d3.extent(data, (d) => d.x) as [number, number];
    const yExtent = d3.extent(data, (d) => d.y) as [number, number];

    // Build X scale — use IQR-robust domain on linear to handle outliers
    let xScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
    if (xScaleType === 'log') {
      const logMin = Math.max(xExtent[0], 1e-6);
      const logMax = Math.max(xExtent[1], logMin * 2);
      xScale = d3.scaleLog().domain([logMin, logMax]).range([0, chartWidth]).nice().clamp(true);
    } else {
      const xDomain = robustDomain(data.map(d => d.x));
      xScale = d3.scaleLinear().domain(xDomain).range([0, chartWidth]).nice().clamp(true);
    }

    // Build Y scale — use IQR-robust domain on linear to handle outliers
    let yScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
    if (yScaleType === 'log') {
      const logMin = Math.max(yExtent[0], 1e-6);
      const logMax = Math.max(yExtent[1], logMin * 2);
      yScale = d3.scaleLog().domain([logMin, logMax]).range([chartHeight, 0]).nice().clamp(true);
    } else {
      const yDomain = robustDomain(data.map(d => d.y));
      yScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]).nice().clamp(true);
    }

    // Size scale
    const sizeExtent: [number, number] = sizeByValue
      ? (d3.extent(data, (d) => d.size ?? 1) as [number, number])
      : [1, 1];
    const sizeScale = createSizeScale(sizeExtent, [5, 20]);

    // Color scale
    const categories = [...new Set(data.map((d) => d.category || 'default'))];
    const colorScale = categoricalScale(categories);

    return { xScale, yScale, sizeScale, colorScale, xExtent, yExtent };
  }, [data, chartWidth, chartHeight, sizeByValue, xScaleType, yScaleType]);

  // Main imperative D3 effect
  useEffect(() => {
    if (!svgRef.current || !baseScales || chartWidth <= 0 || chartHeight <= 0) return;

    const svg = d3.select(svgRef.current);
    const { xScale: baseXScale, yScale: baseYScale, sizeScale, colorScale, xExtent, yExtent } = baseScales;

    // Formatters
    const xFormatter = getFormatter(xFormat);
    const yFormatter = getFormatter(yFormat);

    // Unique clip path id (avoid collisions when multiple scatter plots exist)
    const clipId = 'scatter-clip';

    // ── Setup structure once ──
    let chart = svg.select<SVGGElement>('.chart-group');
    if (chart.empty()) {
      svg.selectAll('*').remove();

      // Clip path
      const defs = svg.append('defs');
      defs.append('clipPath')
        .attr('id', clipId)
        .append('rect');

      chart = svg.append('g').attr('class', 'chart-group');

      // Transparent background rect for zoom target
      chart.append('rect').attr('class', 'zoom-bg')
        .attr('fill', 'transparent');

      // Groups in drawing order
      chart.append('g').attr('class', 'grid-group').attr('opacity', 0.3);
      chart.append('g').attr('class', 'quadrant-group').attr('opacity', 0.5);
      chart.append('line').attr('class', 'regression-line')
        .attr('stroke', CHART_COLORS.baseline)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '6,4')
        .attr('opacity', 0)
        .attr('clip-path', `url(#${clipId})`);
      chart.append('g').attr('class', 'data-group')
        .attr('clip-path', `url(#${clipId})`);
      chart.append('g').attr('class', 'labels-group')
        .attr('clip-path', `url(#${clipId})`);
      chart.append('g').attr('class', 'x-axis-group');
      chart.append('g').attr('class', 'y-axis-group');

      // X axis label
      chart.append('text').attr('class', 'x-axis-label')
        .attr('text-anchor', 'middle')
        .attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('font-size', 13)
        .attr('font-weight', 600);

      // Y axis label
      chart.append('text').attr('class', 'y-axis-label')
        .attr('text-anchor', 'middle')
        .attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('font-size', 13)
        .attr('font-weight', 600);
    }

    // ── Update layout ──
    chart.attr('transform', `translate(${margins.left},${margins.top})`);

    // Update clip rect
    svg.select(`#${clipId} rect`)
      .attr('width', chartWidth)
      .attr('height', chartHeight);

    // Update zoom background
    chart.select('.zoom-bg')
      .attr('width', chartWidth)
      .attr('height', chartHeight);

    // ── Helper: compute zoomed scales from current transform ──
    type ContinuousScale = d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
    function getZoomedScales(transform: d3.ZoomTransform) {
      const xScale = transform.rescaleX(baseXScale as d3.ScaleLinear<number, number>) as ContinuousScale;
      const yScale = transform.rescaleY(baseYScale as d3.ScaleLinear<number, number>) as ContinuousScale;
      return { xScale, yScale };
    }

    // ── Render function (called on zoom and data change) ──
    function render(transform: d3.ZoomTransform, animate: boolean) {
      const { xScale, yScale } = getZoomedScales(transform);
      const duration = animate ? 600 : 0;
      const ease = d3.easeCubicInOut;

      // ── Grid lines (skip in race mode — race effect renders its own) ──
      const gridGroup = chart.select<SVGGElement>('.grid-group');
      if (isRaceMode) {
        gridGroup.selectAll('.x-grid, .y-grid').remove();
      } else {

      // X grid
      const xTicks = (xScale as any).ticks(6) as number[];
      const xGridLines = gridGroup.selectAll<SVGLineElement, number>('.x-grid')
        .data(xTicks, (d: number) => d);

      xGridLines.join(
        enter => enter.append('line')
          .attr('class', 'x-grid')
          .attr('x1', d => xScale(d))
          .attr('x2', d => xScale(d))
          .attr('y1', 0)
          .attr('y2', chartHeight)
          .attr('stroke', CHART_COLORS.outlineVariant)
          .attr('stroke-dasharray', '2,2')
          .attr('opacity', 0)
          .call(sel => sel.transition().duration(duration).ease(ease).attr('opacity', 1)),
        update => {
          update.interrupt().attr('opacity', 1);
          if (duration) {
            update.transition().duration(duration).ease(ease)
              .attr('x1', d => xScale(d))
              .attr('x2', d => xScale(d));
          } else {
            update
              .attr('x1', d => xScale(d))
              .attr('x2', d => xScale(d));
          }
          return update;
        },
        exit => exit
          .interrupt()
          .transition().duration(300).attr('opacity', 0).remove()
      );

      // Y grid
      const yTicks = (yScale as any).ticks(6) as number[];
      const yGridLines = gridGroup.selectAll<SVGLineElement, number>('.y-grid')
        .data(yTicks, (d: number) => d);

      yGridLines.join(
        enter => enter.append('line')
          .attr('class', 'y-grid')
          .attr('x1', 0)
          .attr('x2', chartWidth)
          .attr('y1', d => yScale(d))
          .attr('y2', d => yScale(d))
          .attr('stroke', CHART_COLORS.outlineVariant)
          .attr('stroke-dasharray', '2,2')
          .attr('opacity', 0)
          .call(sel => sel.transition().duration(duration).ease(ease).attr('opacity', 1)),
        update => {
          update.interrupt().attr('opacity', 1);
          if (duration) {
            update.transition().duration(duration).ease(ease)
              .attr('y1', d => yScale(d))
              .attr('y2', d => yScale(d));
          } else {
            update
              .attr('y1', d => yScale(d))
              .attr('y2', d => yScale(d));
          }
          return update;
        },
        exit => exit
          .interrupt()
          .transition().duration(300).attr('opacity', 0).remove()
      );
      } // end !isRaceMode grid lines

      // ── Quadrant lines ──
      const quadrantGroup = chart.select<SVGGElement>('.quadrant-group');
      if (showQuadrants) {
        const xMid = xScaleType === 'log'
          ? Math.sqrt(Math.max(xExtent[0], 1e-6) * Math.max(xExtent[1], 1e-6))
          : (xExtent[0] + xExtent[1]) / 2;
        const yMid = yScaleType === 'log'
          ? Math.sqrt(Math.max(yExtent[0], 1e-6) * Math.max(yExtent[1], 1e-6))
          : (yExtent[0] + yExtent[1]) / 2;

        // Vertical quadrant line
        let vLine = quadrantGroup.select<SVGLineElement>('.quadrant-v');
        if (vLine.empty()) {
          vLine = quadrantGroup.append('line').attr('class', 'quadrant-v')
            .attr('stroke', CHART_COLORS.outlineVariant)
            .attr('stroke-dasharray', '4,4')
            .attr('y1', 0).attr('y2', chartHeight);
        }
        vLine.interrupt().attr('opacity', 0.5);
        if (duration) {
          vLine.transition().duration(duration).ease(ease)
            .attr('x1', xScale(xMid))
            .attr('x2', xScale(xMid))
            .attr('y1', 0)
            .attr('y2', chartHeight);
        } else {
          vLine
            .attr('x1', xScale(xMid))
            .attr('x2', xScale(xMid))
            .attr('y1', 0)
            .attr('y2', chartHeight);
        }

        // Horizontal quadrant line
        let hLine = quadrantGroup.select<SVGLineElement>('.quadrant-h');
        if (hLine.empty()) {
          hLine = quadrantGroup.append('line').attr('class', 'quadrant-h')
            .attr('stroke', CHART_COLORS.outlineVariant)
            .attr('stroke-dasharray', '4,4')
            .attr('x1', 0).attr('x2', chartWidth);
        }
        hLine.interrupt().attr('opacity', 0.5);
        if (duration) {
          hLine.transition().duration(duration).ease(ease)
            .attr('y1', yScale(yMid))
            .attr('y2', yScale(yMid))
            .attr('x1', 0)
            .attr('x2', chartWidth);
        } else {
          hLine
            .attr('y1', yScale(yMid))
            .attr('y2', yScale(yMid))
            .attr('x1', 0)
            .attr('x2', chartWidth);
        }
      } else {
        quadrantGroup.selectAll('*').remove();
      }

      // ── Regression line ──
      const regressionEl = chart.select<SVGLineElement>('.regression-line');
      if (showRegression && data.length >= 2) {
        const n = data.length;
        const sumX = d3.sum(data, (d) => d.x);
        const sumY = d3.sum(data, (d) => d.y);
        const sumXY = d3.sum(data, (d) => d.x * d.y);
        const sumX2 = d3.sum(data, (d) => d.x * d.x);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        const xDomain = xScale.domain();
        const rx1 = xDomain[0] as number;
        const rx2 = xDomain[1] as number;
        const ry1 = slope * rx1 + intercept;
        const ry2 = slope * rx2 + intercept;

        regressionEl.interrupt().attr('opacity', 0.7);
        if (duration) {
          regressionEl.transition().duration(duration).ease(ease)
            .attr('x1', xScale(rx1))
            .attr('x2', xScale(rx2))
            .attr('y1', yScale(ry1))
            .attr('y2', yScale(ry2));
        } else {
          regressionEl
            .attr('x1', xScale(rx1))
            .attr('x2', xScale(rx2))
            .attr('y1', yScale(ry1))
            .attr('y2', yScale(ry2));
        }
      } else {
        regressionEl.interrupt().transition().duration(300).attr('opacity', 0);
      }

      // ── Quartile thresholds for color coding ──
      const yValues = data.map(d => d.y).sort((a, b) => a - b);
      const q1 = d3.quantile(yValues, 0.25) ?? 0;
      const q2 = d3.quantile(yValues, 0.5) ?? 0;
      const q3 = d3.quantile(yValues, 0.75) ?? 0;

      function getQuartileColor(d: ScatterDataPoint): string {
        if (colorByCategory) return colorScale(d.category || 'default');
        if (d.y >= q3) return QUARTILE_COLORS[0]; // Top 25% — teal
        if (d.y >= q2) return QUARTILE_COLORS[1]; // Q2 — blue
        if (d.y >= q1) return QUARTILE_COLORS[2]; // Q3 — amber
        return QUARTILE_COLORS[3];                 // Bottom 25% — coral
      }

      // ── Data points (D3 data join) — skip in race mode (race effect manages dots) ──
      const dataGroup = chart.select<SVGGElement>('.data-group');

      if (isRaceMode) {
        // Clear any static dots + labels so race effect starts clean
        dataGroup.selectAll('.scatter-point').remove();
        chart.select('.labels-group').selectAll('.scatter-label').remove();
      } else {
      const points = dataGroup.selectAll<SVGCircleElement, ScatterDataPoint>('.scatter-point')
        .data(data, (d: ScatterDataPoint) => d.id);

      // Determine if this is the initial render (no existing points)
      const isInitial = points.enter().size() === data.length && points.exit().size() === 0 && points.size() === 0;

      // Enter
      points.enter()
        .append('circle')
        .attr('class', 'scatter-point')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 0)
        .attr('opacity', 0)
        .attr('fill', d => getQuartileColor(d))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .style('cursor', onPointClickRef.current ? 'pointer' : 'default')
        .on('mouseenter', function (event: MouseEvent, d: ScatterDataPoint) {
          const el = d3.select(this);
          const currentR = parseFloat(el.attr('r'));
          el.interrupt('hover')
            .transition('hover')
            .duration(150)
            .attr('r', currentR * 1.2)
            .attr('opacity', 1)
            .attr('stroke-width', 2.5);

          const xFmt = getFormatter(xFormat);
          const yFmt = getFormatter(yFormat);

          const content = d.tooltip || buildTooltipContent(d, xFmt, yFmt);
          showTooltipRef.current(event.clientX, event.clientY, content);
        })
        .on('mousemove', function (event: MouseEvent) {
          moveTooltipRef.current(event.clientX, event.clientY);
        })
        .on('mouseleave', function (this: SVGCircleElement, _event: MouseEvent, d: ScatterDataPoint) {
          const targetR = sizeByValue ? sizeScale(d.size ?? 1) : 8;
          d3.select(this)
            .interrupt('hover')
            .transition('hover')
            .duration(150)
            .attr('r', targetR)
            .attr('opacity', 0.7)
            .attr('stroke-width', 1.5);
          hideTooltipRef.current();
        })
        .on('click', function (_event: MouseEvent, d: ScatterDataPoint) {
          if (onPointClickRef.current) onPointClickRef.current(d);
        })
        .transition()
        .duration(400)
        .delay((_, i) => isInitial ? i * 15 : 0)
        .ease(ease)
        .attr('r', d => sizeByValue ? sizeScale(d.size ?? 1) : 8)
        .attr('opacity', 0.7);

      // Update
      points
        .interrupt()
        .attr('opacity', 0.7)
        .attr('fill', d => getQuartileColor(d))
        .style('cursor', onPointClickRef.current ? 'pointer' : 'default')
        .call(sel => {
          // Re-bind event handlers on update to capture latest closure values
          sel
            .on('mouseenter', function (event: MouseEvent, d: ScatterDataPoint) {
              const el = d3.select(this);
              const currentR = parseFloat(el.attr('r'));
              el.interrupt('hover')
                .transition('hover')
                .duration(150)
                .attr('r', currentR * 1.2)
                .attr('opacity', 1)
                .attr('stroke-width', 2.5);

              const xFmt = getFormatter(xFormat);
              const yFmt = getFormatter(yFormat);
              const content = d.tooltip || buildTooltipContent(d, xFmt, yFmt);
              showTooltipRef.current(event.clientX, event.clientY, content);
            })
            .on('mousemove', function (event: MouseEvent) {
              moveTooltipRef.current(event.clientX, event.clientY);
            })
            .on('mouseleave', function (this: SVGCircleElement, _event: MouseEvent, d: ScatterDataPoint) {
              const targetR = sizeByValue ? sizeScale(d.size ?? 1) : 8;
              d3.select(this)
                .interrupt('hover')
                .transition('hover')
                .duration(150)
                .attr('r', targetR)
                .attr('opacity', 0.7)
                .attr('stroke-width', 1.5);
              hideTooltipRef.current();
            })
            .on('click', function (_event: MouseEvent, d: ScatterDataPoint) {
              if (onPointClickRef.current) onPointClickRef.current(d);
            });
        })
        .transition()
        .duration(duration)
        .ease(ease)
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', d => sizeByValue ? sizeScale(d.size ?? 1) : 8);

      // Exit
      points.exit()
        .interrupt()
        .transition()
        .duration(300)
        .attr('r', 0)
        .attr('opacity', 0)
        .remove();

      // ── Smart labels — pick a percentage of each quartile for spatial coverage ──
      const labelsGroup = chart.select<SVGGElement>('.labels-group');

      // Decide which points to label:
      // - ≤15 dots: label all
      // - >15 dots: always label primary, then pick ~30% from each Y-quartile
      //   (ensures labels spread across all color bands)
      const n = data.length;
      let labelCandidates: ScatterDataPoint[];

      if (n <= 15) {
        labelCandidates = data;
      } else {
        const selected = new Set<string>();
        // Always include the primary market
        for (const d of data) { if ((d.size ?? 0) > 10) selected.add(d.id); }

        // Split into 4 quartiles by Y value
        const sorted = [...data].sort((a, b) => a.y - b.y);
        const quartileSize = Math.ceil(sorted.length / 4);
        const quartiles = [
          sorted.slice(0, quartileSize),
          sorted.slice(quartileSize, quartileSize * 2),
          sorted.slice(quartileSize * 2, quartileSize * 3),
          sorted.slice(quartileSize * 3),
        ];

        // Pick ~30% of each quartile (min 1), choosing the most spread-out
        // points by X value within each quartile
        for (const qPoints of quartiles) {
          if (qPoints.length === 0) continue;
          const count = Math.max(1, Math.round(qPoints.length * 0.3));
          // Sort by X and evenly sample for spatial spread
          const byX = [...qPoints].sort((a, b) => a.x - b.x);
          const step = Math.max(1, Math.floor(byX.length / count));
          for (let i = 0; i < byX.length && selected.size < n; i += step) {
            selected.add(byX[i].id);
          }
        }

        labelCandidates = data.filter(d => selected.has(d.id));
      }

      // Shorten label: "Austin-Round Rock, TX" → "Austin, TX"
      function shortLabel(label: string): string {
        // Strip everything after first hyphen before the comma
        return label.replace(/^([^,\-]+)[^,]*,/, '$1,');
      }

      // Position labels with edge-aware offsets + collision avoidance
      type LabelDatum = { id: string; lx: number; ly: number; anchor: 'start' | 'end'; text: string; primary: boolean };
      const labelData: LabelDatum[] = labelCandidates.map(d => {
        const px = xScale(d.x);
        const py = yScale(d.y);
        const text = shortLabel(d.label);
        const estW = text.length * 5.5;
        const { dx, dy, anchor } = labelOffset(px, py, estW, chartWidth, chartHeight);
        return {
          id: d.id,
          lx: px + dx,
          ly: py + dy,
          anchor,
          text,
          primary: (d.size ?? 0) > 10,
        };
      });

      // Simple collision avoidance: hide labels that overlap previous ones
      const LABEL_H = 11; // approx text height
      const LABEL_PAD = 4;
      const placed: { x: number; y: number; w: number }[] = [];

      function overlaps(lx: number, ly: number, lw: number): boolean {
        for (const p of placed) {
          if (
            Math.abs(ly - p.y) < LABEL_H + LABEL_PAD &&
            lx < p.x + p.w + LABEL_PAD &&
            lx + lw > p.x - LABEL_PAD
          ) return true;
        }
        return false;
      }

      // Sort: primary first, then by x position for stable ordering
      labelData.sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0) || a.lx - b.lx);

      const visibleLabels: LabelDatum[] = [];
      for (const ld of labelData) {
        const estWidth = ld.text.length * 5.5;
        // For end-anchored labels, the bounding box extends leftward
        const boxX = ld.anchor === 'end' ? ld.lx - estWidth : ld.lx;
        if (!overlaps(boxX, ld.ly, estWidth)) {
          placed.push({ x: boxX, y: ld.ly, w: estWidth });
          visibleLabels.push(ld);
        }
      }

      // D3 data join for labels
      const labels = labelsGroup
        .selectAll<SVGTextElement, LabelDatum>('.scatter-label')
        .data(visibleLabels, (d: LabelDatum) => d.id);

      labels.enter()
        .append('text')
        .attr('class', 'scatter-label')
        .attr('x', d => d.lx)
        .attr('y', d => d.ly)
        .attr('text-anchor', d => d.anchor)
        .attr('font-size', d => d.primary ? '11px' : '9px')
        .attr('font-weight', d => d.primary ? 600 : 400)
        .attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('opacity', 0)
        .text(d => d.text)
        .transition()
        .duration(400)
        .attr('opacity', d => d.primary ? 0.9 : 0.6);

      labels
        .transition()
        .duration(duration)
        .ease(ease)
        .attr('x', d => d.lx)
        .attr('y', d => d.ly)
        .attr('text-anchor', d => d.anchor)
        .attr('font-size', d => d.primary ? '11px' : '9px')
        .attr('font-weight', d => d.primary ? 600 : 400)
        .attr('opacity', d => d.primary ? 0.9 : 0.6)
        .text(d => d.text);

      labels.exit()
        .transition()
        .duration(200)
        .attr('opacity', 0)
        .remove();

      } // end !isRaceMode

      // ── Axes ──
      const xAxisGroup = chart.select<SVGGElement>('.x-axis-group');
      xAxisGroup.attr('transform', `translate(0,${chartHeight})`);
      const xAxisGen = createXAxis({
        scale: xScale as d3.AxisScale<d3.AxisDomain>,
        tickCount: 6,
        formatType: xFormat,
      });
      if (animate) {
        animateAxis(xAxisGroup, xAxisGen, duration);
      } else {
        xAxisGroup.call(xAxisGen);
      }
      // Style axis elements
      xAxisGroup.selectAll('line, path').attr('stroke', CHART_COLORS.outline);
      xAxisGroup.selectAll('text')
        .attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('font-size', '11px');

      const yAxisGroup = chart.select<SVGGElement>('.y-axis-group');
      const yAxisGen = createYAxis({
        scale: yScale as d3.AxisScale<d3.AxisDomain>,
        tickCount: 6,
        formatType: yFormat,
      });
      if (animate) {
        animateAxis(yAxisGroup, yAxisGen, duration);
      } else {
        yAxisGroup.call(yAxisGen);
      }
      yAxisGroup.selectAll('line, path').attr('stroke', CHART_COLORS.outline);
      yAxisGroup.selectAll('text')
        .attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('font-size', '11px');

      // ── Axis labels ──
      const xLabelEl = chart.select<SVGTextElement>('.x-axis-label');
      if (xLabel) {
        xLabelEl
          .attr('x', chartWidth / 2)
          .attr('y', chartHeight + 45)
          .text(xLabel)
          .attr('opacity', 1);
      } else {
        xLabelEl.attr('opacity', 0);
      }

      const yLabelEl = chart.select<SVGTextElement>('.y-axis-label');
      if (yLabel) {
        yLabelEl
          .attr('transform', `translate(-70,${chartHeight / 2}) rotate(-90)`)
          .text(yLabel)
          .attr('opacity', 1);
      } else {
        yLabelEl.attr('opacity', 0);
      }
    }

    // ── Build tooltip content ──
    function buildTooltipContent(
      d: ScatterDataPoint,
      xFmt: (v: number) => string,
      yFmt: (v: number) => string
    ): React.ReactNode {
      return React.createElement('div', { className: 'min-w-[180px]' },
        React.createElement('div', {
          className: 'font-semibold text-sm border-b border-white/20 pb-1 mb-1.5'
        }, d.label),
        React.createElement('div', { className: 'space-y-0.5 text-xs' },
          React.createElement('div', { className: 'flex justify-between gap-4' },
            React.createElement('span', { className: 'opacity-70' }, `${xLabel || 'X'}:`),
            React.createElement('span', { className: 'font-medium' }, xFmt(d.x))
          ),
          React.createElement('div', { className: 'flex justify-between gap-4' },
            React.createElement('span', { className: 'opacity-70' }, `${yLabel || 'Y'}:`),
            React.createElement('span', { className: 'font-medium' }, yFmt(d.y))
          ),
          d.size !== undefined
            ? React.createElement('div', { className: 'flex justify-between gap-4' },
                React.createElement('span', { className: 'opacity-70' }, 'Size:'),
                React.createElement('span', { className: 'font-medium' }, d.size.toLocaleString())
              )
            : null,
          d.category
            ? React.createElement('div', { className: 'flex justify-between gap-4' },
                React.createElement('span', { className: 'opacity-70' }, 'Category:'),
                React.createElement('span', { className: 'font-medium' }, d.category)
              )
            : null
        ),
        onPointClickRef.current
          ? React.createElement('div', {
              className: 'text-[10px] opacity-60 mt-2 pt-1 border-t border-white/20'
            }, 'Click for details')
          : null
      );
    }

    // ── Initial render with entrance animation ──
    render(zoomTransformRef.current, true);

    // ── Zoom behavior ──
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .extent([[0, 0], [chartWidth, chartHeight]])
      .translateExtent([[-chartWidth, -chartHeight], [chartWidth * 2, chartHeight * 2]])
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform;
        // Re-render imperatively on zoom with short transitions
        render(event.transform, false);
      });

    svg.call(zoom);

    // Double-click to reset zoom
    svg.on('dblclick.zoom', () => {
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    });

    // If we had a previous zoom transform, restore it
    if (zoomTransformRef.current !== d3.zoomIdentity) {
      svg.call(zoom.transform, zoomTransformRef.current);
    }

    return () => {
      svg.on('.zoom', null);
    };
  }, [
    baseScales, data, chartWidth, chartHeight, margins,
    xFormat, yFormat, xLabel, yLabel,
    xScaleType, yScaleType,
    showRegression, showQuadrants, quadrantLabels,
    colorByCategory, sizeByValue, isRaceMode,
  ]);

  // ── Race mode rendering ──
  useEffect(() => {
    if (!isRaceMode || !raceFrames || raceFrames.length === 0) return;
    if (!svgRef.current || chartWidth <= 0 || chartHeight <= 0) return;

    const svg = d3.select(svgRef.current);
    const clipId = 'scatter-clip';

    // Ensure SVG structure exists (may not if static data was empty)
    let chart = svg.select<SVGGElement>('.chart-group');
    if (chart.empty()) {
      svg.selectAll('*').remove();
      const defs = svg.append('defs');
      defs.append('clipPath').attr('id', clipId).append('rect');
      chart = svg.append('g').attr('class', 'chart-group');
      chart.append('rect').attr('class', 'zoom-bg').attr('fill', 'transparent');
      chart.append('g').attr('class', 'grid-group').attr('opacity', 0.3);
      chart.append('g').attr('class', 'quadrant-group').attr('opacity', 0.5);
      chart.append('line').attr('class', 'regression-line')
        .attr('stroke', CHART_COLORS.baseline).attr('stroke-width', 2)
        .attr('stroke-dasharray', '6,4').attr('opacity', 0)
        .attr('clip-path', `url(#${clipId})`);
      chart.append('g').attr('class', 'data-group').attr('clip-path', `url(#${clipId})`);
      chart.append('g').attr('class', 'labels-group').attr('clip-path', `url(#${clipId})`);
      chart.append('g').attr('class', 'x-axis-group');
      chart.append('g').attr('class', 'y-axis-group');
      chart.append('text').attr('class', 'x-axis-label')
        .attr('text-anchor', 'middle').attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('font-size', 13).attr('font-weight', 600);
      chart.append('text').attr('class', 'y-axis-label')
        .attr('text-anchor', 'middle').attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('font-size', 13).attr('font-weight', 600);
    }

    chart.attr('transform', `translate(${margins.left},${margins.top})`);
    svg.select(`#${clipId} rect`).attr('width', chartWidth).attr('height', chartHeight);
    chart.select('.zoom-bg').attr('width', chartWidth).attr('height', chartHeight);

    // Disable zoom in race mode
    svg.on('.zoom', null);

    // ── Compute GLOBAL scales across ALL frames so axes stay fixed ──
    // This is the key to smooth Gapminder-style animation: a stable coordinate
    // system means only dots move, not the grid/axes.
    const allPoints = raceFrames!.flatMap(f => f.points);

    let globalXScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
    let globalYScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;

    if (xScaleType === 'log') {
      const xMin = Math.max(d3.min(allPoints, d => d.x) ?? 1, 1);
      const xMax = Math.max(d3.max(allPoints, d => d.x) ?? xMin * 2, xMin * 1.1);
      globalXScale = d3.scaleLog().domain([xMin, xMax]).range([0, chartWidth]).nice().clamp(true);
    } else {
      const xDomain = robustDomain(allPoints.map(d => d.x));
      globalXScale = d3.scaleLinear().domain(xDomain).range([0, chartWidth]).nice().clamp(true);
    }

    if (yScaleType === 'log') {
      const yMin = Math.max(d3.min(allPoints, d => d.y) ?? 1, 1);
      const yMax = Math.max(d3.max(allPoints, d => d.y) ?? yMin * 2, yMin * 1.1);
      globalYScale = d3.scaleLog().domain([yMin, yMax]).range([chartHeight, 0]).nice().clamp(true);
    } else {
      const yDomain = robustDomain(allPoints.map(d => d.y));
      globalYScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]).nice().clamp(true);
    }

    // Global size scale
    const globalSizeExtent = d3.extent(allPoints, d => d.size ?? 1) as [number, number];
    const globalSizeScale = (globalSizeExtent[0] === globalSizeExtent[1])
      ? () => 8
      : d3.scaleSqrt<number, number>().domain(globalSizeExtent).range([6, 14]);

    // ── Render static axes ONCE (they don't change per-frame) ──
    const xAxisGroup = chart.select<SVGGElement>('.x-axis-group');
    xAxisGroup.attr('transform', `translate(0,${chartHeight})`);
    const xAxisGen = createXAxis({
      scale: globalXScale as d3.AxisScale<d3.AxisDomain>,
      tickCount: 6,
      formatType: xFormat,
    });
    xAxisGroup.call(xAxisGen);
    xAxisGroup.selectAll('line, path').attr('stroke', CHART_COLORS.outline);
    xAxisGroup.selectAll('text').attr('fill', CHART_COLORS.onSurfaceVariant).attr('font-size', '11px');

    const yAxisGroup = chart.select<SVGGElement>('.y-axis-group');
    const yAxisGen = createYAxis({
      scale: globalYScale as d3.AxisScale<d3.AxisDomain>,
      tickCount: 6,
      formatType: yFormat,
    });
    yAxisGroup.call(yAxisGen);
    yAxisGroup.selectAll('line, path').attr('stroke', CHART_COLORS.outline);
    yAxisGroup.selectAll('text').attr('fill', CHART_COLORS.onSurfaceVariant).attr('font-size', '11px');

    // ── Grid lines (race mode) ──
    const gridGroup = chart.select<SVGGElement>('.grid-group');
    const xTicks = (globalXScale as any).ticks(6) as number[];
    gridGroup.selectAll<SVGLineElement, number>('.x-grid')
      .data(xTicks, (d: number) => d)
      .join('line')
      .attr('class', 'x-grid')
      .attr('x1', d => globalXScale(d))
      .attr('x2', d => globalXScale(d))
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', CHART_COLORS.outlineVariant)
      .attr('stroke-dasharray', '2,2');

    const yTicks = (globalYScale as any).ticks(6) as number[];
    gridGroup.selectAll<SVGLineElement, number>('.y-grid')
      .data(yTicks, (d: number) => d)
      .join('line')
      .attr('class', 'y-grid')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', d => globalYScale(d))
      .attr('y2', d => globalYScale(d))
      .attr('stroke', CHART_COLORS.outlineVariant)
      .attr('stroke-dasharray', '2,2');

    // Axis labels (static)
    const xLabelEl = chart.select<SVGTextElement>('.x-axis-label');
    if (xLabel) {
      xLabelEl.attr('x', chartWidth / 2).attr('y', chartHeight + 45).text(xLabel).attr('opacity', 1);
    } else {
      xLabelEl.attr('opacity', 0);
    }
    const yLabelEl = chart.select<SVGTextElement>('.y-axis-label');
    if (yLabel) {
      yLabelEl.attr('transform', `translate(-70,${chartHeight / 2}) rotate(-90)`).text(yLabel).attr('opacity', 1);
    } else {
      yLabelEl.attr('opacity', 0);
    }

    // ── Compute a STABLE label set ONCE across ALL frames ──
    // This prevents labels from flickering on/off as dots shift positions.
    // We aggregate each market's median position, pick labels from that,
    // and keep the same IDs labeled throughout the entire animation.

    // Shorten label: "Austin-Round Rock, TX" → "Austin, TX"
    function shortLabel(label: string): string {
      return label.replace(/^([^,\-]+)[^,]*,/, '$1,');
    }

    // Aggregate: for each market, compute median X and Y across all frames
    const marketAgg = new Map<string, { xs: number[]; ys: number[]; label: string; size: number }>();
    for (const frame of raceFrames!) {
      for (const pt of frame.points) {
        let agg = marketAgg.get(pt.id);
        if (!agg) {
          agg = { xs: [], ys: [], label: pt.label, size: pt.size ?? 8 };
          marketAgg.set(pt.id, agg);
        }
        agg.xs.push(pt.x);
        agg.ys.push(pt.y);
      }
    }

    // Build a synthetic "average position" dataset to pick labels from
    type AggPoint = { id: string; label: string; medX: number; medY: number; primary: boolean };
    const aggPoints: AggPoint[] = [];
    for (const [id, agg] of marketAgg) {
      const xs = [...agg.xs].sort((a, b) => a - b);
      const ys = [...agg.ys].sort((a, b) => a - b);
      aggPoints.push({
        id,
        label: agg.label,
        medX: xs[Math.floor(xs.length / 2)],
        medY: ys[Math.floor(ys.length / 2)],
        primary: agg.size > 10,
      });
    }

    // Pick which IDs to label (same quartile strategy but on stable median positions)
    const stableLabelIds = new Set<string>();
    const totalAgg = aggPoints.length;

    if (totalAgg <= 15) {
      for (const p of aggPoints) stableLabelIds.add(p.id);
    } else {
      // Always include primary
      for (const p of aggPoints) { if (p.primary) stableLabelIds.add(p.id); }

      // Split by median Y into 4 quartiles
      const sortedAgg = [...aggPoints].sort((a, b) => a.medY - b.medY);
      const qSize = Math.ceil(sortedAgg.length / 4);
      const quarts = [
        sortedAgg.slice(0, qSize),
        sortedAgg.slice(qSize, qSize * 2),
        sortedAgg.slice(qSize * 2, qSize * 3),
        sortedAgg.slice(qSize * 3),
      ];
      for (const qPts of quarts) {
        if (qPts.length === 0) continue;
        const count = Math.max(1, Math.round(qPts.length * 0.3));
        const byX = [...qPts].sort((a, b) => a.medX - b.medX);
        const step = Math.max(1, Math.floor(byX.length / count));
        for (let i = 0; i < byX.length; i += step) {
          stableLabelIds.add(byX[i].id);
        }
      }
    }

    // Build a lookup of short text + primary flag (stable across frames)
    const labelMeta = new Map<string, { text: string; primary: boolean }>();
    for (const p of aggPoints) {
      if (stableLabelIds.has(p.id)) {
        labelMeta.set(p.id, { text: shortLabel(p.label), primary: p.primary });
      }
    }

    // ── Per-frame render: only dots + labels + regression line move ──
    function renderRaceFrame(frameIdx: number) {
      const frame = raceFrames![frameIdx];
      if (!frame) return;

      const points = frame.points;
      // Transition should take the full interval so the next frame starts
      // exactly when this transition finishes — no gap, no overlap.
      const transitionDuration = speed;

      // Quartile thresholds for this frame
      const yValues = points.map(d => d.y).sort((a, b) => a - b);
      const q1 = d3.quantile(yValues, 0.25) ?? 0;
      const q2 = d3.quantile(yValues, 0.5) ?? 0;
      const q3 = d3.quantile(yValues, 0.75) ?? 0;

      function getQuartileColor(d: ScatterDataPoint): string {
        if (d.y >= q3) return QUARTILE_COLORS[0];
        if (d.y >= q2) return QUARTILE_COLORS[1];
        if (d.y >= q1) return QUARTILE_COLORS[2];
        return QUARTILE_COLORS[3];
      }

      const dataGroup = chart.select<SVGGElement>('.data-group');

      // Data join with key
      const dots = dataGroup
        .selectAll<SVGCircleElement, ScatterDataPoint>('.scatter-point')
        .data(points, (d: ScatterDataPoint) => d.id);

      // Enter — new markets appearing in this frame
      dots.enter()
        .append('circle')
        .attr('class', 'scatter-point')
        .attr('cx', d => globalXScale(d.x))
        .attr('cy', d => globalYScale(d.y))
        .attr('r', 0)
        .attr('opacity', 0)
        .attr('fill', d => getQuartileColor(d))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .transition('race')
        .duration(transitionDuration * 0.4)
        .attr('r', d => globalSizeScale(d.size ?? 1))
        .attr('opacity', 0.7);

      // Update — existing markets glide to new positions
      // Use a named transition so the next frame's transition seamlessly
      // takes over (d3 replaces same-name transitions rather than fighting).
      dots
        .attr('fill', d => getQuartileColor(d))
        .transition('race')
        .duration(transitionDuration)
        .ease(d3.easeLinear)
        .attr('cx', d => globalXScale(d.x))
        .attr('cy', d => globalYScale(d.y))
        .attr('r', d => globalSizeScale(d.size ?? 1))
        .attr('opacity', 0.7);

      // Exit — markets disappearing from this frame
      dots.exit()
        .transition('race')
        .duration(transitionDuration * 0.4)
        .attr('r', 0)
        .attr('opacity', 0)
        .remove();

      // ── Labels — use the pre-computed stable set, just update positions ──
      const labelsGroup = chart.select<SVGGElement>('.labels-group');

      // Build label data for this frame with edge-aware offsets
      type LabelDatum = { id: string; lx: number; ly: number; anchor: 'start' | 'end'; text: string; primary: boolean };
      const frameLabelData: LabelDatum[] = [];
      for (const pt of points) {
        const meta = labelMeta.get(pt.id);
        if (!meta) continue;
        const px = globalXScale(pt.x);
        const py = globalYScale(pt.y);
        const estW = meta.text.length * 5.5;
        const { dx, dy, anchor } = labelOffset(px, py, estW, chartWidth, chartHeight);
        frameLabelData.push({
          id: pt.id,
          lx: px + dx,
          ly: py + dy,
          anchor,
          text: meta.text,
          primary: meta.primary,
        });
      }

      // D3 data join for labels — stable IDs mean no flickering
      const raceLabels = labelsGroup
        .selectAll<SVGTextElement, LabelDatum>('.scatter-label')
        .data(frameLabelData, (d: LabelDatum) => d.id);

      raceLabels.enter()
        .append('text')
        .attr('class', 'scatter-label')
        .attr('x', d => d.lx)
        .attr('y', d => d.ly)
        .attr('text-anchor', d => d.anchor)
        .attr('font-size', d => d.primary ? '11px' : '9px')
        .attr('font-weight', d => d.primary ? 600 : 400)
        .attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('opacity', 0)
        .text(d => d.text)
        .transition('race')
        .duration(transitionDuration * 0.4)
        .attr('opacity', d => d.primary ? 0.9 : 0.6);

      raceLabels
        .transition('race')
        .duration(transitionDuration)
        .ease(d3.easeLinear)
        .attr('x', d => d.lx)
        .attr('y', d => d.ly)
        .attr('text-anchor', d => d.anchor)
        .attr('opacity', d => d.primary ? 0.9 : 0.6);

      raceLabels.exit()
        .transition('race')
        .duration(transitionDuration * 0.3)
        .attr('opacity', 0)
        .remove();

      // Regression line (updates per frame)
      const regressionEl = chart.select<SVGLineElement>('.regression-line');
      if (showRegression && points.length >= 2) {
        const n = points.length;
        const sumX = d3.sum(points, d => d.x);
        const sumY = d3.sum(points, d => d.y);
        const sumXY = d3.sum(points, d => d.x * d.y);
        const sumX2 = d3.sum(points, d => d.x * d.x);
        const denom = n * sumX2 - sumX * sumX;
        if (denom !== 0) {
          const slope = (n * sumXY - sumX * sumY) / denom;
          const intercept = (sumY - slope * sumX) / n;
          const xDomain = globalXScale.domain();
          regressionEl.attr('opacity', 0.7)
            .transition('race').duration(transitionDuration).ease(d3.easeLinear)
            .attr('x1', globalXScale(xDomain[0]))
            .attr('x2', globalXScale(xDomain[1]))
            .attr('y1', globalYScale(slope * xDomain[0] + intercept))
            .attr('y2', globalYScale(slope * xDomain[1] + intercept));
        }
      } else {
        regressionEl.attr('opacity', 0);
      }

      setCurrentDate(frame.date);
    }

    renderFrameRef.current = renderRaceFrame;

    // Render initial frame
    renderRaceFrame(frameRef.current);
  }, [isRaceMode, raceFrames, chartWidth, chartHeight, margins, speed, showRegression, xFormat, yFormat, xLabel, yLabel, xScaleType, yScaleType]);

  // ── Race playback loop ──
  useEffect(() => {
    if (!isPlaying || !isRaceMode || !raceFrames?.length) return;
    timerRef.current = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % raceFrames.length;
      setCurrentFrame(frameRef.current);
      renderFrameRef.current?.(frameRef.current);
      onFrameChangeRef.current?.(frameRef.current, raceFrames[frameRef.current].date);
    }, speed);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, speed, raceFrames, isRaceMode]);

  const togglePlay = useCallback(() => setIsPlaying(p => !p), []);
  const seekToFrame = useCallback((idx: number) => {
    frameRef.current = idx;
    setCurrentFrame(idx);
    renderFrameRef.current?.(idx);
    if (raceFrames) onFrameChangeRef.current?.(idx, raceFrames[idx].date);
  }, [raceFrames]);

  if ((!data || data.length === 0) && !isRaceMode) {
    return (
      <div className={`flex items-center justify-center bg-surface-container rounded-2xl h-full ${className}`}>
        <p className="text-on-surface-variant">No data available</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative h-full ${className}`}>
      <svg
        ref={svgRef}
        width={width || '100%'}
        height={effectiveHeight}
        className="overflow-visible"
        style={{ cursor: 'grab' }}
      />

      {/* Legend */}
      {!colorByCategory && yLabel && (
        <div className="absolute top-2 right-2 bg-surface-container-lowest/90 backdrop-blur-sm rounded-xl border border-outline-variant/20 px-3 py-2 pointer-events-none">
          <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
            {yLabel}
          </div>
          <div className="flex flex-col gap-1">
            {[
              { color: QUARTILE_COLORS[0], label: 'Top 25%' },
              { color: QUARTILE_COLORS[1], label: '50–75%' },
              { color: QUARTILE_COLORS[2], label: '25–50%' },
              { color: QUARTILE_COLORS[3], label: 'Bottom 25%' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-on-surface-variant">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zoom hint */}
      {!isRaceMode && (
        <div className="absolute bottom-2 right-2 text-[10px] text-on-surface-variant opacity-60 pointer-events-none">
          Scroll to zoom &bull; Drag to pan &bull; Double-click to reset
        </div>
      )}

      {/* Race mode playback controls */}
      {isRaceMode && raceFrames && (
        <PlaybackControls
          frameCount={raceFrames.length}
          currentFrame={currentFrame}
          currentDate={currentDate}
          isPlaying={isPlaying}
          speed={speed}
          onTogglePlay={togglePlay}
          onSeek={seekToFrame}
          onSpeedChange={setSpeed}
        />
      )}

      <D3Tooltip {...tooltip} />
    </div>
  );
};

export default ScatterPlot;
