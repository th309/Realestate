'use client';

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { useResponsiveD3, useD3Tooltip, D3Tooltip } from '@/lib/visualizations/d3/hooks/useD3';
import {
  CHART_COLORS,
  createLinearScale,
  createTimeScale,
  formatters,
  type FormatType,
} from '@/lib/visualizations/d3/utils/scales';
import {
  createTimeAxis,
  createYAxis,
  animateAxis,
  getChartDimensions,
  type ChartMargins,
} from '@/lib/visualizations/d3/utils/axes';
import { formatMetricValue, getMetricFormat, getMetricTitle } from '@/lib/data';
import type { TimeSeriesPoint } from '@/lib/data';
import type { TimeFrame } from '../hooks/useGraphsState';

interface AnimatedTimeSeriesChartProps {
  primaryData: TimeSeriesPoint[];
  primaryLabel: string;
  primaryColor?: string;
  comparisonData?: TimeSeriesPoint[];
  comparisonLabel?: string;
  comparisonColor?: string;
  baselineData?: TimeSeriesPoint[];
  baselineLabel?: string;
  baselineColor?: string;
  metricId: string;
  timeFrame: TimeFrame;
  onTimeFrameChange: (tf: TimeFrame) => void;
  isLoading: boolean;
  error?: string | null;
}

const MARGINS: ChartMargins = { top: 32, right: 80, bottom: 40, left: 60 };

/** Calculate date range for a timeframe */
function getDateRange(tf: TimeFrame): { startDate: string; endDate: string } | { historyMonths: number } {
  const now = new Date();
  switch (tf) {
    case '1Y': return { historyMonths: 12 };
    case '3Y': return { historyMonths: 36 };
    case '5Y': return { historyMonths: 60 };
    case '10Y': return { historyMonths: 120 };
    case 'Max': return { historyMonths: 240 };
  }
}

export function AnimatedTimeSeriesChart({
  primaryData,
  primaryLabel,
  primaryColor = CHART_COLORS.primary,
  comparisonData,
  comparisonLabel,
  comparisonColor = CHART_COLORS.comparison,
  baselineData,
  baselineLabel,
  baselineColor = CHART_COLORS.baseline,
  metricId,
  timeFrame,
  onTimeFrameChange,
  isLoading,
  error,
}: AnimatedTimeSeriesChartProps) {
  const { containerRef, width: containerWidth, height: containerHeight } =
    useResponsiveD3<HTMLDivElement>(16 / 9, 360, true);
  const svgRef = useRef<SVGSVGElement>(null);
  const { tooltip, showTooltip, hideTooltip, moveTooltip } = useD3Tooltip();
  const prevDataRef = useRef<string>('');
  const hasAnimatedIn = useRef(false);

  const format = getMetricFormat(metricId);
  const metricTitle = getMetricTitle(metricId);

  // Parse dates once
  const parsedPrimary = useMemo(() =>
    primaryData.map(d => ({ date: new Date(d.date), value: d.value })),
    [primaryData]
  );

  const parsedComparison = useMemo(() =>
    comparisonData?.map(d => ({ date: new Date(d.date), value: d.value })) || [],
    [comparisonData]
  );

  const parsedBaseline = useMemo(() =>
    baselineData?.map(d => ({ date: new Date(d.date), value: d.value })) || [],
    [baselineData]
  );

  // Compute scales
  const { width, height } = useMemo(
    () => getChartDimensions(containerWidth, containerHeight, MARGINS),
    [containerWidth, containerHeight]
  );

  // Format value for display
  const fmtValue = useCallback((v: number) => {
    return formatMetricValue(v, format);
  }, [format]);

  // D3 axis format function
  const axisFormat = useCallback((v: number, i: number) => {
    // First tick gets the unit prefix, rest are just numbers
    const formatted = fmtValue(v);
    return formatted;
  }, [fmtValue]);

  // Main D3 render
  useEffect(() => {
    if (!svgRef.current || width <= 0 || height <= 0 || parsedPrimary.length === 0) return;

    const svg = d3.select(svgRef.current);
    const dataKey = JSON.stringify({ p: primaryData.length, c: comparisonData?.length, b: baselineData?.length, m: metricId, w: width });
    const isNewData = dataKey !== prevDataRef.current;
    const isFirstRender = !hasAnimatedIn.current;
    prevDataRef.current = dataKey;

    // Combine all values for Y domain
    const allValues = [
      ...parsedPrimary.map(d => d.value),
      ...parsedComparison.map(d => d.value),
      ...parsedBaseline.map(d => d.value),
    ];
    const allDates = [
      ...parsedPrimary.map(d => d.date),
      ...parsedComparison.map(d => d.date),
      ...parsedBaseline.map(d => d.date),
    ];

    const yExtent = d3.extent(allValues) as [number, number];
    const xExtent = d3.extent(allDates) as [Date, Date];

    const xScale = createTimeScale(xExtent, [0, width]);
    const yScale = createLinearScale(yExtent, [height, 0], 0.08);

    // Line generator
    const line = d3.line<{ date: Date; value: number }>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Area generator
    const area = d3.area<{ date: Date; value: number }>()
      .x(d => xScale(d.date))
      .y0(height)
      .y1(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // ── SETUP SVG STRUCTURE ──
    // Clear on first render, update on subsequent
    let chart = svg.select<SVGGElement>('.chart-group');
    if (chart.empty()) {
      svg.selectAll('*').remove();

      // Gradient definitions
      const defs = svg.append('defs');

      // Primary gradient
      const primaryGrad = defs.append('linearGradient')
        .attr('id', 'primary-area-gradient')
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '0%').attr('y2', '100%');
      primaryGrad.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', primaryColor)
        .attr('stop-opacity', 0.25);
      primaryGrad.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', primaryColor)
        .attr('stop-opacity', 0.02);

      // Comparison gradient (same weight as primary for equal visual prominence)
      const compGrad = defs.append('linearGradient')
        .attr('id', 'comparison-area-gradient')
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '0%').attr('y2', '100%');
      compGrad.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', comparisonColor)
        .attr('stop-opacity', 0.2);
      compGrad.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', comparisonColor)
        .attr('stop-opacity', 0.02);

      // Clip path
      defs.append('clipPath')
        .attr('id', 'chart-clip')
        .append('rect')
        .attr('width', width)
        .attr('height', height);

      chart = svg.append('g')
        .attr('class', 'chart-group')
        .attr('transform', `translate(${MARGINS.left},${MARGINS.top})`);

      // Grid lines group
      chart.append('g').attr('class', 'grid-lines');
      // Axes
      chart.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${height})`);
      chart.append('g').attr('class', 'y-axis');
      // Data layers (clipped)
      const dataGroup = chart.append('g').attr('class', 'data-group').attr('clip-path', 'url(#chart-clip)');
      dataGroup.append('path').attr('class', 'comparison-area');
      dataGroup.append('path').attr('class', 'primary-area');
      dataGroup.append('path').attr('class', 'comparison-line');
      dataGroup.append('path').attr('class', 'baseline-line');
      dataGroup.append('path').attr('class', 'primary-line');
      // Labels group
      chart.append('g').attr('class', 'labels-group');
      // Crosshair group
      const crosshair = chart.append('g').attr('class', 'crosshair').style('display', 'none');
      crosshair.append('line').attr('class', 'crosshair-line')
        .attr('y1', 0).attr('y2', height)
        .attr('stroke', CHART_COLORS.onSurfaceVariant)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.5);
      crosshair.append('circle').attr('class', 'crosshair-dot-primary')
        .attr('r', 5)
        .attr('fill', primaryColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
      crosshair.append('circle').attr('class', 'crosshair-dot-comparison')
        .attr('r', 5)
        .attr('fill', comparisonColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('display', 'none');
      crosshair.append('circle').attr('class', 'crosshair-dot-baseline')
        .attr('r', 4)
        .attr('fill', baselineColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .style('display', 'none');
      // Interaction overlay
      chart.append('rect').attr('class', 'interaction-overlay')
        .attr('width', width)
        .attr('height', height)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair');
    }

    // Update clip rect on resize
    svg.select('#chart-clip rect').attr('width', width).attr('height', height);

    // ── GRID LINES ──
    const gridGroup = chart.select('.grid-lines');
    gridGroup.selectAll('line').remove();
    const yTicks = yScale.ticks(5);
    yTicks.forEach(tick => {
      gridGroup.append('line')
        .attr('x1', 0).attr('x2', width)
        .attr('y1', yScale(tick)).attr('y2', yScale(tick))
        .attr('stroke', CHART_COLORS.outlineVariant)
        .attr('stroke-opacity', 0.25)
        .attr('stroke-dasharray', '3,3');
    });

    // ── AXES ──
    const xAxisGen = createTimeAxis(xScale, width);
    const yAxisGen = createYAxis({
      scale: yScale as any,
      tickCount: 5,
      tickFormat: (v) => fmtValue(v as number),
    });

    const dur = isNewData ? 400 : 0;
    animateAxis(chart.select('.x-axis') as any, xAxisGen as any, dur);
    animateAxis(chart.select('.y-axis') as any, yAxisGen as any, dur);

    // Style axes
    chart.selectAll('.x-axis text, .y-axis text')
      .attr('fill', CHART_COLORS.onSurfaceVariant)
      .attr('font-size', '11px')
      .style('font-family', 'inherit');
    chart.selectAll('.x-axis line, .x-axis path, .y-axis line, .y-axis path')
      .attr('stroke', CHART_COLORS.outlineVariant)
      .attr('stroke-opacity', 0.4);

    // ── DATA PATHS ──
    const primaryPathD = line(parsedPrimary) || '';
    const primaryAreaD = area(parsedPrimary) || '';
    const compPathD = parsedComparison.length > 0 ? (line(parsedComparison) || '') : '';
    const compAreaD = parsedComparison.length > 0 ? (area(parsedComparison) || '') : '';
    const baselinePathD = parsedBaseline.length > 0 ? (line(parsedBaseline) || '') : '';

    if (isFirstRender) {
      // INITIAL ANIMATION: Line draws in from left
      hasAnimatedIn.current = true;

      // Primary area (fade in)
      chart.select('.primary-area')
        .attr('d', primaryAreaD)
        .attr('fill', 'url(#primary-area-gradient)')
        .attr('opacity', 0)
        .transition()
        .duration(1000)
        .delay(400)
        .ease(d3.easeQuadOut)
        .attr('opacity', 1);

      // Primary line (stroke-dashoffset draw-in)
      const primaryPath = chart.select('.primary-line')
        .attr('d', primaryPathD)
        .attr('fill', 'none')
        .attr('stroke', primaryColor)
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round');

      const pathNode = primaryPath.node() as SVGPathElement | null;
      if (pathNode) {
        const totalLength = pathNode.getTotalLength();
        primaryPath
          .attr('stroke-dasharray', totalLength)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(1200)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0)
          .on('end', function() {
            d3.select(this).attr('stroke-dasharray', 'none');
          });
      }

      // Comparison (if present, animate in after primary)
      if (compPathD) {
        chart.select('.comparison-area')
          .attr('d', compAreaD)
          .attr('fill', 'url(#comparison-area-gradient)')
          .attr('opacity', 0)
          .transition()
          .duration(800)
          .delay(800)
          .ease(d3.easeQuadOut)
          .attr('opacity', 1);

        const compPath = chart.select('.comparison-line')
          .attr('d', compPathD)
          .attr('fill', 'none')
          .attr('stroke', comparisonColor)
          .attr('stroke-width', 2.5)
          .attr('stroke-linecap', 'round')
          .attr('stroke-dasharray', 'none');

        const compNode = compPath.node() as SVGPathElement | null;
        if (compNode) {
          const compLen = compNode.getTotalLength();
          compPath
            .attr('stroke-dasharray', compLen)
            .attr('stroke-dashoffset', compLen)
            .transition()
            .duration(1000)
            .delay(600)
            .ease(d3.easeCubicOut)
            .attr('stroke-dashoffset', 0)
            .on('end', function() {
              d3.select(this).attr('stroke-dasharray', 'none');
            });
        }
      }

      // Baseline (dotted orange line, animate in)
      if (baselinePathD) {
        const bPath = chart.select('.baseline-line')
          .attr('d', baselinePathD)
          .attr('fill', 'none')
          .attr('stroke', baselineColor)
          .attr('stroke-width', 1.8)
          .attr('stroke-linecap', 'round')
          .attr('stroke-dasharray', '4,4');

        const bNode = bPath.node() as SVGPathElement | null;
        if (bNode) {
          const bLen = bNode.getTotalLength();
          bPath
            .attr('stroke-dasharray', bLen)
            .attr('stroke-dashoffset', bLen)
            .transition()
            .duration(900)
            .delay(500)
            .ease(d3.easeCubicOut)
            .attr('stroke-dashoffset', 0)
            .on('end', function() {
              d3.select(this).attr('stroke-dasharray', '4,4');
            });
        }
      }
    } else {
      // SUBSEQUENT UPDATES: smooth morph
      chart.select('.primary-line')
        .interrupt()
        .attr('fill', 'none')
        .attr('stroke', primaryColor)
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round')
        .attr('stroke-dasharray', 'none')
        .attr('stroke-dashoffset', 0)
        .attr('opacity', 1)
        .transition()
        .duration(600)
        .ease(d3.easeCubicInOut)
        .attr('d', primaryPathD);

      chart.select('.primary-area')
        .interrupt()
        .attr('fill', 'url(#primary-area-gradient)')
        .attr('opacity', 1)
        .transition()
        .duration(600)
        .ease(d3.easeCubicInOut)
        .attr('d', primaryAreaD);

      if (compPathD) {
        const compLine = chart.select('.comparison-line');
        const compArea = chart.select('.comparison-area');
        // Interrupt any running removal transitions to prevent opacity races
        compLine.interrupt();
        compArea.interrupt();
        const currentD = compLine.attr('d');

        if (!currentD || currentD === '') {
          // Comparison just appeared — animate in
          compArea
            .attr('d', compAreaD)
            .attr('fill', 'url(#comparison-area-gradient)')
            .attr('opacity', 0)
            .transition()
            .duration(600)
            .attr('opacity', 1);

          const newCompPath = compLine
            .attr('opacity', 1)
            .attr('d', compPathD)
            .attr('fill', 'none')
            .attr('stroke', comparisonColor)
            .attr('stroke-width', 2.5)
            .attr('stroke-linecap', 'round');

          const node = newCompPath.node() as SVGPathElement | null;
          if (node) {
            const len = node.getTotalLength();
            newCompPath
              .attr('stroke-dasharray', len)
              .attr('stroke-dashoffset', len)
              .transition()
              .duration(800)
              .ease(d3.easeCubicOut)
              .attr('stroke-dashoffset', 0)
              .on('end', function() {
                d3.select(this).attr('stroke-dasharray', 'none');
              });
          }
        } else {
          // Morph existing comparison — ensure visible
          compLine
            .attr('opacity', 1)
            .transition()
            .duration(600)
            .ease(d3.easeCubicInOut)
            .attr('d', compPathD);

          compArea
            .attr('opacity', 1)
            .transition()
            .duration(600)
            .ease(d3.easeCubicInOut)
            .attr('d', compAreaD);
        }
      } else {
        // Remove comparison
        chart.select('.comparison-line').transition().duration(300).attr('opacity', 0)
          .on('end', function() { d3.select(this).attr('d', '').attr('opacity', 1); });
        chart.select('.comparison-area').transition().duration(300).attr('opacity', 0)
          .on('end', function() { d3.select(this).attr('d', '').attr('opacity', 1); });
      }

      // ── BASELINE UPDATE ──
      if (baselinePathD) {
        const bLine = chart.select('.baseline-line');
        // Interrupt any running removal transition to prevent opacity races
        bLine.interrupt();
        const currentBD = bLine.attr('d');

        if (!currentBD || currentBD === '') {
          // Baseline just appeared — animate in
          const bPath = bLine
            .attr('opacity', 1)
            .attr('d', baselinePathD)
            .attr('fill', 'none')
            .attr('stroke', baselineColor)
            .attr('stroke-width', 1.8)
            .attr('stroke-linecap', 'round');

          const bNode = bPath.node() as SVGPathElement | null;
          if (bNode) {
            const bLen = bNode.getTotalLength();
            bPath
              .attr('stroke-dasharray', bLen)
              .attr('stroke-dashoffset', bLen)
              .transition()
              .duration(800)
              .ease(d3.easeCubicOut)
              .attr('stroke-dashoffset', 0)
              .on('end', function() {
                d3.select(this).attr('stroke-dasharray', '4,4');
              });
          }
        } else {
          // Morph existing baseline — ensure visible
          bLine
            .attr('opacity', 1)
            .transition()
            .duration(600)
            .ease(d3.easeCubicInOut)
            .attr('d', baselinePathD);
        }
      } else {
        // Remove baseline
        chart.select('.baseline-line').transition().duration(300).attr('opacity', 0)
          .on('end', function() { d3.select(this).attr('d', '').attr('opacity', 1); });
      }
    }

    // ── INLINE LABELS (Datawrapper-style) ──
    const labelsGroup = chart.select('.labels-group');
    labelsGroup.selectAll('*').remove();

    if (parsedPrimary.length > 0) {
      const first = parsedPrimary[0];
      const last = parsedPrimary[parsedPrimary.length - 1];
      const peak = parsedPrimary.reduce((max, d) => d.value > max.value ? d : max, parsedPrimary[0]);
      const trough = parsedPrimary.reduce((min, d) => d.value < min.value ? d : min, parsedPrimary[0]);

      // End value label (always show)
      const endX = xScale(last.date);
      const endY = yScale(last.value);
      labelsGroup.append('text')
        .attr('x', endX + 8)
        .attr('y', endY + 4)
        .attr('fill', primaryColor)
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .text(fmtValue(last.value))
        .attr('opacity', 0)
        .transition()
        .delay(isFirstRender ? 1200 : 0)
        .duration(400)
        .attr('opacity', 1);

      // Start value label
      const startX = xScale(first.date);
      const startY = yScale(first.value);
      labelsGroup.append('text')
        .attr('x', startX - 8)
        .attr('y', startY + 4)
        .attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('font-size', '11px')
        .attr('text-anchor', 'end')
        .text(fmtValue(first.value))
        .attr('opacity', 0)
        .transition()
        .delay(isFirstRender ? 1400 : 0)
        .duration(400)
        .attr('opacity', 0.7);

      // Peak label (only if meaningfully different from start/end)
      const peakIsDifferent =
        Math.abs(peak.value - last.value) / last.value > 0.05 &&
        Math.abs(peak.value - first.value) / first.value > 0.05;
      if (peakIsDifferent) {
        const peakX = xScale(peak.date);
        const peakY = yScale(peak.value);
        labelsGroup.append('circle')
          .attr('cx', peakX).attr('cy', peakY).attr('r', 3)
          .attr('fill', primaryColor)
          .attr('opacity', 0)
          .transition()
          .delay(isFirstRender ? 1400 : 0)
          .duration(300)
          .attr('opacity', 0.6);
        labelsGroup.append('text')
          .attr('x', peakX)
          .attr('y', peakY - 10)
          .attr('fill', primaryColor)
          .attr('font-size', '10px')
          .attr('text-anchor', 'middle')
          .attr('opacity', 0)
          .text(`Peak: ${fmtValue(peak.value)}`)
          .transition()
          .delay(isFirstRender ? 1500 : 0)
          .duration(400)
          .attr('opacity', 0.7);
      }

      // Comparison end label
      if (parsedComparison.length > 0) {
        const compLast = parsedComparison[parsedComparison.length - 1];
        const compEndX = xScale(compLast.date);
        const compEndY = yScale(compLast.value);
        labelsGroup.append('text')
          .attr('x', compEndX + 8)
          .attr('y', compEndY + 4)
          .attr('fill', comparisonColor)
          .attr('font-size', '12px')
          .attr('font-weight', '600')
          .text(fmtValue(compLast.value))
          .attr('opacity', 0)
          .transition()
          .delay(isFirstRender ? 1400 : 0)
          .duration(400)
          .attr('opacity', 1);
      }

      // Baseline end label (e.g., "TX Avg" or "National Avg")
      if (parsedBaseline.length > 0) {
        const bLast = parsedBaseline[parsedBaseline.length - 1];
        const bEndX = xScale(bLast.date);
        const bEndY = yScale(bLast.value);
        // Value
        labelsGroup.append('text')
          .attr('x', bEndX + 8)
          .attr('y', bEndY - 2)
          .attr('fill', baselineColor)
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .text(fmtValue(bLast.value))
          .attr('opacity', 0)
          .transition()
          .delay(isFirstRender ? 1400 : 0)
          .duration(400)
          .attr('opacity', 0.9);
        // Label
        if (baselineLabel) {
          labelsGroup.append('text')
            .attr('x', bEndX + 8)
            .attr('y', bEndY + 10)
            .attr('fill', baselineColor)
            .attr('font-size', '9px')
            .attr('font-weight', '500')
            .text(baselineLabel)
            .attr('opacity', 0)
            .transition()
            .delay(isFirstRender ? 1500 : 0)
            .duration(400)
            .attr('opacity', 0.7);
        }
      }
    }

    // ── HOVER INTERACTION ──
    const bisect = d3.bisector<{ date: Date; value: number }, Date>(d => d.date).left;

    chart.select('.interaction-overlay')
      .attr('width', width)
      .attr('height', height)
      .on('mousemove', function(event: MouseEvent) {
        const [mx] = d3.pointer(event, this);
        const hoveredDate = xScale.invert(mx);
        const idx = bisect(parsedPrimary, hoveredDate, 1);
        const d0 = parsedPrimary[idx - 1];
        const d1 = parsedPrimary[idx];
        if (!d0) return;
        const closest = d1 && (hoveredDate.getTime() - d0.date.getTime()) > (d1.date.getTime() - hoveredDate.getTime()) ? d1 : d0;

        const cx = xScale(closest.date);
        const cy = yScale(closest.value);

        const crosshairGroup = chart.select('.crosshair').style('display', null);
        crosshairGroup.select('.crosshair-line')
          .attr('x1', cx).attr('x2', cx);
        crosshairGroup.select('.crosshair-dot-primary')
          .attr('cx', cx).attr('cy', cy);

        // Build tooltip rows — always include primary
        const tooltipRows: { color: string; label: string; value: string; dotted?: boolean }[] = [
          { color: primaryColor, label: primaryLabel, value: fmtValue(closest.value) },
        ];

        // Comparison dot + tooltip row
        if (parsedComparison.length > 0) {
          const compIdx = bisect(parsedComparison, closest.date, 1);
          const cd0 = parsedComparison[compIdx - 1];
          const cd1 = parsedComparison[compIdx];
          if (cd0) {
            const compClosest = cd1 && (closest.date.getTime() - cd0.date.getTime()) > (cd1.date.getTime() - closest.date.getTime()) ? cd1 : cd0;
            crosshairGroup.select('.crosshair-dot-comparison')
              .style('display', null)
              .attr('cx', cx)
              .attr('cy', yScale(compClosest.value));
            tooltipRows.push({ color: comparisonColor, label: comparisonLabel || 'Comparison', value: fmtValue(compClosest.value) });
          }
        } else {
          crosshairGroup.select('.crosshair-dot-comparison').style('display', 'none');
        }

        // Baseline dot + tooltip row
        if (parsedBaseline.length > 0) {
          const bIdx = bisect(parsedBaseline, closest.date, 1);
          const bd0 = parsedBaseline[bIdx - 1];
          const bd1 = parsedBaseline[bIdx];
          if (bd0) {
            const bClosest = bd1 && (closest.date.getTime() - bd0.date.getTime()) > (bd1.date.getTime() - closest.date.getTime()) ? bd1 : bd0;
            crosshairGroup.select('.crosshair-dot-baseline')
              .style('display', null)
              .attr('cx', cx)
              .attr('cy', yScale(bClosest.value));
            tooltipRows.push({ color: baselineColor, label: baselineLabel || 'Baseline', value: fmtValue(bClosest.value), dotted: true });
          }
        } else {
          crosshairGroup.select('.crosshair-dot-baseline').style('display', 'none');
        }

        // Show combined tooltip
        const dateStr = d3.timeFormat('%b %Y')(closest.date);
        showTooltip(
          cx + MARGINS.left,
          cy + MARGINS.top,
          <div className="text-xs">
            <div className="font-medium mb-1">{dateStr}</div>
            {tooltipRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${row.dotted ? 'border border-current' : ''}`} style={{ backgroundColor: row.dotted ? 'transparent' : row.color, borderColor: row.dotted ? row.color : undefined }} />
                <span>{row.label}: <strong>{row.value}</strong></span>
              </div>
            ))}
          </div>
        );
      })
      .on('mouseleave', () => {
        chart.select('.crosshair').style('display', 'none');
        hideTooltip();
      });

  }, [parsedPrimary, parsedComparison, parsedBaseline, width, height, metricId, primaryColor, comparisonColor, baselineColor, primaryLabel, comparisonLabel, baselineLabel, fmtValue, showTooltip, hideTooltip]);

  // Loading state
  if (isLoading && primaryData.length === 0) {
    return (
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-on-surface-variant">Loading chart data...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && primaryData.length === 0) {
    return (
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-on-surface-variant">Unable to load chart data</p>
          <p className="text-xs text-on-surface-variant/60 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (primaryData.length === 0) {
    return (
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-on-surface-variant">Select a market to see chart data</p>
      </div>
    );
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="w-full h-full relative">
      {/* Metric title */}
      <div className="absolute top-0 left-14 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
        {metricTitle}
      </div>

      <svg
        ref={svgRef}
        width={containerWidth}
        height={containerHeight}
        className="overflow-visible"
      />

      {/* Legend (when comparison or baseline active) */}
      {((comparisonData && comparisonData.length > 0) || (baselineData && baselineData.length > 0)) && (
        <div className="absolute top-0 right-0 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span className="text-on-surface-variant">{primaryLabel}</span>
          </div>
          {comparisonData && comparisonData.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: comparisonColor }} />
              <span className="text-on-surface-variant">{comparisonLabel}</span>
            </div>
          )}
          {baselineData && baselineData.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0 border-t border-dotted" style={{ borderColor: baselineColor, borderWidth: '2px' }} />
              <span className="text-on-surface-variant">{baselineLabel}</span>
            </div>
          )}
        </div>
      )}

      {/* D3 Tooltip */}
      <D3Tooltip {...tooltip} />
    </div>
  );
}

export default AnimatedTimeSeriesChart;
