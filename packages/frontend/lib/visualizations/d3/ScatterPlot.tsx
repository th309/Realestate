'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useD3Tooltip, D3Tooltip, useResponsiveD3 } from './hooks/useD3';
import {
  CHART_COLORS,
  createLinearScale,
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

const QUARTILE_COLORS = ['#0891b2', '#3b82f6', '#f59e0b', '#f97316'] as const;

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

  // Margins
  const margins = useMemo(() => ({
    left: 90,
    right: 30,
    top: 20,
    bottom: 60,
  }), []);

  const effectiveHeight = responsiveHeight || height;
  const chartWidth = (width || 600) - margins.left - margins.right;
  const chartHeight = effectiveHeight - margins.top - margins.bottom;

  // Calculate base scales
  const baseScales = useMemo(() => {
    if (data.length === 0) return null;

    const xExtent = d3.extent(data, (d) => d.x) as [number, number];
    const yExtent = d3.extent(data, (d) => d.y) as [number, number];

    // Build X scale
    let xScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
    if (xScaleType === 'log') {
      const logMin = Math.max(xExtent[0], 1e-6);
      const logMax = Math.max(xExtent[1], logMin * 2);
      xScale = d3.scaleLog().domain([logMin, logMax]).range([0, chartWidth]).nice().clamp(true);
    } else {
      const xPadding = (xExtent[1] - xExtent[0]) * 0.05;
      xScale = createLinearScale(
        [xExtent[0] - xPadding, xExtent[1] + xPadding],
        [0, chartWidth]
      );
    }

    // Build Y scale
    let yScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
    if (yScaleType === 'log') {
      const logMin = Math.max(yExtent[0], 1e-6);
      const logMax = Math.max(yExtent[1], logMin * 2);
      yScale = d3.scaleLog().domain([logMin, logMax]).range([chartHeight, 0]).nice().clamp(true);
    } else {
      const yPadding = (yExtent[1] - yExtent[0]) * 0.05;
      yScale = createLinearScale(
        [yExtent[0] - yPadding, yExtent[1] + yPadding],
        [chartHeight, 0]
      );
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

      // ── Grid lines ──
      const gridGroup = chart.select<SVGGElement>('.grid-group');

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

      // ── Data points (D3 data join) ──
      const dataGroup = chart.select<SVGGElement>('.data-group');

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
    colorByCategory, sizeByValue,
  ]);

  // ── Race mode rendering ──
  useEffect(() => {
    if (!isRaceMode || !raceFrames || raceFrames.length === 0) return;
    if (!svgRef.current || !baseScales || chartWidth <= 0 || chartHeight <= 0) return;

    const svg = d3.select(svgRef.current);
    const { sizeScale } = baseScales;

    function renderRaceFrame(frameIdx: number) {
      const frame = raceFrames![frameIdx];
      if (!frame) return;

      const points = frame.points;
      const transitionDuration = speed * 0.8;

      // Recompute scales for this frame's data
      const xExtent = d3.extent(points, d => d.x) as [number, number];
      const yExtent = d3.extent(points, d => d.y) as [number, number];
      const xPadding = (xExtent[1] - xExtent[0]) * 0.05 || 1;
      const yPadding = (yExtent[1] - yExtent[0]) * 0.05 || 1;

      const xScale = d3.scaleLinear()
        .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
        .range([0, chartWidth]);

      const yScale = d3.scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .range([chartHeight, 0]);

      // Quartile thresholds
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

      const chart = svg.select<SVGGElement>('.chart-group');
      const dataGroup = chart.select<SVGGElement>('.data-group');

      // Data join with key
      const dots = dataGroup
        .selectAll<SVGCircleElement, ScatterDataPoint>('.scatter-point')
        .data(points, (d: ScatterDataPoint) => d.id);

      // Enter
      dots.enter()
        .append('circle')
        .attr('class', 'scatter-point')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 0)
        .attr('opacity', 0)
        .attr('fill', d => getQuartileColor(d))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .transition()
        .duration(transitionDuration * 0.5)
        .attr('r', d => sizeByValue ? sizeScale(d.size ?? 1) : 8)
        .attr('opacity', 0.7);

      // Update
      dots
        .interrupt()
        .attr('fill', d => getQuartileColor(d))
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeLinear)
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', d => sizeByValue ? sizeScale(d.size ?? 1) : 8)
        .attr('opacity', 0.7);

      // Exit
      dots.exit()
        .interrupt()
        .transition()
        .duration(transitionDuration * 0.5)
        .attr('r', 0)
        .attr('opacity', 0)
        .remove();

      // Update axes
      const xAxisGroup = chart.select<SVGGElement>('.x-axis-group');
      xAxisGroup.attr('transform', `translate(0,${chartHeight})`);
      const xAxisGen = createXAxis({
        scale: xScale as d3.AxisScale<d3.AxisDomain>,
        tickCount: 6,
        formatType: xFormat,
      });
      animateAxis(xAxisGroup, xAxisGen, transitionDuration);
      xAxisGroup.selectAll('line, path').attr('stroke', CHART_COLORS.outline);
      xAxisGroup.selectAll('text').attr('fill', CHART_COLORS.onSurfaceVariant).attr('font-size', '11px');

      const yAxisGroup = chart.select<SVGGElement>('.y-axis-group');
      const yAxisGen = createYAxis({
        scale: yScale as d3.AxisScale<d3.AxisDomain>,
        tickCount: 6,
        formatType: yFormat,
      });
      animateAxis(yAxisGroup, yAxisGen, transitionDuration);
      yAxisGroup.selectAll('line, path').attr('stroke', CHART_COLORS.outline);
      yAxisGroup.selectAll('text').attr('fill', CHART_COLORS.onSurfaceVariant).attr('font-size', '11px');

      // Regression line (update per frame if enabled)
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
          const xDomain = xScale.domain();
          regressionEl.interrupt().attr('opacity', 0.7)
            .transition().duration(transitionDuration).ease(d3.easeLinear)
            .attr('x1', xScale(xDomain[0]))
            .attr('x2', xScale(xDomain[1]))
            .attr('y1', yScale(slope * xDomain[0] + intercept))
            .attr('y2', yScale(slope * xDomain[1] + intercept));
        }
      } else {
        regressionEl.interrupt().attr('opacity', 0);
      }

      setCurrentDate(frame.date);
    }

    renderFrameRef.current = renderRaceFrame;

    // Render initial frame
    renderRaceFrame(frameRef.current);
  }, [isRaceMode, raceFrames, baseScales, chartWidth, chartHeight, speed, sizeByValue, showRegression, xFormat, yFormat]);

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
