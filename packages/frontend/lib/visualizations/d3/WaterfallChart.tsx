'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { useD3Tooltip, D3Tooltip, useResponsiveD3 } from './hooks/useD3';
import { CHART_COLORS } from './utils/scales';

export interface WaterfallBar {
  label: string;
  value: number;          // contribution amount (positive or negative)
  rawValue?: number;      // original metric value for tooltip
  formattedRaw?: string;  // formatted original value
  category?: string;
}

export interface WaterfallChartProps {
  bars: WaterfallBar[];
  totalLabel?: string;
  totalValue?: number;
  height?: number;
  className?: string;
  formatValue?: (v: number) => string;
  title?: string;
}

const BAR_COLORS = {
  positive: '#22c55e',
  negative: '#ef4444',
  total: '#4f46e5',
} as const;

const CONNECTOR_COLOR = '#9ca3af';

function defaultFormatValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(1);
}

/** Cumulative item used for D3 data joins */
interface CumulativeItem {
  bar: WaterfallBar;
  start: number;
  end: number;
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({
  bars,
  totalLabel = 'Total',
  totalValue,
  height = 400,
  className = '',
  formatValue = defaultFormatValue,
  title,
}) => {
  const { containerRef, width, height: responsiveHeight } = useResponsiveD3<HTMLDivElement>(16 / 9, height, true);
  const svgRef = useRef<SVGSVGElement>(null);
  const { tooltip, showTooltip, hideTooltip, moveTooltip } = useD3Tooltip();
  const hasAnimatedIn = useRef(false);
  const prevDataKey = useRef<string>('');

  // Store tooltip functions in refs so D3 callbacks always see the latest
  const showTooltipRef = useRef(showTooltip);
  showTooltipRef.current = showTooltip;
  const hideTooltipRef = useRef(hideTooltip);
  hideTooltipRef.current = hideTooltip;
  const moveTooltipRef = useRef(moveTooltip);
  moveTooltipRef.current = moveTooltip;
  const formatValueRef = useRef(formatValue);
  formatValueRef.current = formatValue;

  // Tooltip content builder stored in a ref for D3 access
  const tooltipContentRef = useRef<(bar: WaterfallBar, isTotal: boolean) => React.ReactNode>(undefined);
  tooltipContentRef.current = (bar: WaterfallBar, isTotal: boolean) => (
    <div className="min-w-[160px]">
      <div className="font-semibold text-sm border-b border-white/20 pb-1 mb-1.5">
        {bar.label}
      </div>
      <div className="space-y-0.5 text-xs">
        <div className="flex justify-between gap-4">
          <span className="opacity-70">
            {isTotal ? 'Total:' : 'Contribution:'}
          </span>
          <span className="font-medium">
            {bar.value >= 0 ? '+' : ''}{formatValueRef.current(bar.value)}
          </span>
        </div>
        {bar.rawValue !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="opacity-70">Metric Value:</span>
            <span className="font-medium">
              {bar.formattedRaw || bar.rawValue.toLocaleString()}
            </span>
          </div>
        )}
        {bar.category && (
          <div className="flex justify-between gap-4">
            <span className="opacity-70">Category:</span>
            <span className="font-medium">{bar.category}</span>
          </div>
        )}
      </div>
    </div>
  );

  const margins = useMemo(() => ({
    top: title ? 48 : 24,
    right: 20,
    bottom: 80,
    left: 70,
  }), [title]);

  const effectiveHeight = responsiveHeight || height;
  const chartWidth = Math.max((width || 600) - margins.left - margins.right, 0);
  const chartHeight = Math.max(effectiveHeight - margins.top - margins.bottom, 0);

  // Compute sorted bars, cumulative layout, total, and scales
  const { cumulativeData, total, xScale, yScale } = useMemo(() => {
    if (bars.length === 0) {
      return {
        cumulativeData: [] as CumulativeItem[],
        total: 0,
        xScale: d3.scaleBand<string>().domain([]).range([0, chartWidth]).padding(0.25),
        yScale: d3.scaleLinear().domain([0, 1]).range([chartHeight, 0]),
      };
    }

    const sorted = [...bars].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    const cumulative: CumulativeItem[] = [];
    let runningTotal = 0;
    for (const bar of sorted) {
      const start = runningTotal;
      const end = runningTotal + bar.value;
      cumulative.push({ bar, start, end });
      runningTotal = end;
    }

    const computedTotal = totalValue !== undefined ? totalValue : runningTotal;

    const xDomain = [...sorted.map((b) => b.label), totalLabel];
    const xScale = d3.scaleBand<string>()
      .domain(xDomain)
      .range([0, chartWidth])
      .padding(0.25);

    const allValues = cumulative.flatMap((c) => [c.start, c.end]);
    allValues.push(0, computedTotal);
    const yMin = Math.min(...allValues);
    const yMax = Math.max(...allValues);
    const yPadding = (yMax - yMin) * 0.1 || 1;

    const yScale = d3.scaleLinear()
      .domain([Math.min(yMin - yPadding, 0), yMax + yPadding])
      .range([chartHeight, 0])
      .nice();

    return { cumulativeData: cumulative, total: computedTotal, xScale, yScale };
  }, [bars, totalLabel, totalValue, chartWidth, chartHeight]);

  // Main imperative D3 render
  useEffect(() => {
    if (!svgRef.current || chartWidth <= 0 || chartHeight <= 0) return;

    const svg = d3.select(svgRef.current);

    // Track whether this is first render or a data update
    const dataKey = JSON.stringify({
      labels: bars.map(b => b.label).join(','),
      values: bars.map(b => b.value).join(','),
      total: totalValue,
      w: chartWidth,
      h: chartHeight,
    });
    const isFirstRender = !hasAnimatedIn.current;
    const isNewData = dataKey !== prevDataKey.current;
    prevDataKey.current = dataKey;

    const zeroY = yScale(0);
    const bandwidth = xScale.bandwidth();
    const dur = isFirstRender ? 600 : 500;

    // ── SETUP SVG STRUCTURE ──
    let chart = svg.select<SVGGElement>('.chart-group');
    if (chart.empty()) {
      svg.selectAll('*').remove();

      chart = svg.append('g')
        .attr('class', 'chart-group')
        .attr('transform', `translate(${margins.left},${margins.top})`);

      // Create groups in rendering order (back to front)
      chart.append('g').attr('class', 'grid-lines');
      chart.append('line').attr('class', 'zero-line');
      chart.append('g').attr('class', 'connectors');
      chart.append('g').attr('class', 'bars');
      chart.append('g').attr('class', 'total-bar-group');
      chart.append('g').attr('class', 'value-labels');
      chart.append('g').attr('class', 'y-axis');
      chart.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${chartHeight})`);
    }

    // Update chart-group transform on resize
    chart.attr('transform', `translate(${margins.left},${margins.top})`);

    // ── TITLE (no animation) ──
    svg.selectAll('.chart-title').remove();
    if (title) {
      svg.append('text')
        .attr('class', 'chart-title')
        .attr('x', margins.left + chartWidth / 2)
        .attr('y', margins.top / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', CHART_COLORS.onSurface)
        .attr('font-size', 15)
        .attr('font-weight', 600)
        .text(title);
    }

    // ── GRID LINES ──
    const gridGroup = chart.select<SVGGElement>('.grid-lines');
    const gridTicks = yScale.ticks(6);
    const gridLines = gridGroup.selectAll<SVGLineElement, number>('line')
      .data(gridTicks, (d: number) => d);

    gridLines.exit().remove();

    gridLines.enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('stroke', CHART_COLORS.outlineVariant)
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.25)
      .merge(gridLines)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('x2', chartWidth);

    // ── ZERO LINE ──
    chart.select<SVGLineElement>('.zero-line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', zeroY)
      .attr('y2', zeroY)
      .attr('stroke', CHART_COLORS.outline)
      .attr('stroke-width', 1);

    // ── CONTRIBUTION BARS (D3 data join) ──
    const barsGroup = chart.select<SVGGElement>('.bars');

    const barGroups = barsGroup.selectAll<SVGGElement, CumulativeItem>('.bar-group')
      .data(cumulativeData, d => d.bar.label);

    // EXIT: shrink to zero line and fade out
    const exitGroups = barGroups.exit<CumulativeItem>();
    exitGroups.select('.bar-rect')
      .interrupt()
      .transition()
      .duration(300)
      .attr('y', zeroY)
      .attr('height', 0)
      .attr('opacity', 0);
    exitGroups.select('.bar-label')
      .interrupt()
      .transition()
      .duration(200)
      .attr('opacity', 0);
    exitGroups
      .transition()
      .delay(300)
      .remove();

    // ENTER: create new bar groups
    const enterGroups = barGroups.enter()
      .append('g')
      .attr('class', 'bar-group');

    enterGroups.append('rect')
      .attr('class', 'bar-rect')
      .attr('x', d => xScale(d.bar.label) ?? 0)
      .attr('y', zeroY)
      .attr('width', bandwidth)
      .attr('height', 0)
      .attr('fill', d => d.bar.value >= 0 ? BAR_COLORS.positive : BAR_COLORS.negative)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('opacity', 0.85)
      .style('cursor', 'pointer');

    enterGroups.append('text')
      .attr('class', 'bar-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .attr('opacity', 0);

    // MERGE: animate enter + update together
    const merged = enterGroups.merge(barGroups);

    // Animate rects
    merged.select<SVGRectElement>('.bar-rect')
      .interrupt()
      .attr('opacity', 0.85)
      .transition()
      .duration(dur)
      .delay((_, i) => isFirstRender ? i * 80 : 0)
      .ease(d3.easeCubicOut)
      .attr('x', d => xScale((d as CumulativeItem).bar.label) ?? 0)
      .attr('width', bandwidth)
      .attr('y', d => {
        const item = d as CumulativeItem;
        return Math.min(yScale(item.start), yScale(item.end));
      })
      .attr('height', d => {
        const item = d as CumulativeItem;
        return Math.max(Math.abs(yScale(item.end) - yScale(item.start)), 1);
      })
      .attr('fill', d => (d as CumulativeItem).bar.value >= 0 ? BAR_COLORS.positive : BAR_COLORS.negative);

    // Animate value labels
    merged.select<SVGTextElement>('.bar-label')
      .interrupt()
      .transition()
      .duration(dur)
      .delay((_, i) => isFirstRender ? i * 80 + 300 : 0)
      .ease(d3.easeCubicOut)
      .attr('x', d => {
        const item = d as CumulativeItem;
        return (xScale(item.bar.label) ?? 0) + bandwidth / 2;
      })
      .attr('y', d => {
        const item = d as CumulativeItem;
        const isPositive = item.bar.value >= 0;
        return isPositive
          ? Math.min(yScale(item.start), yScale(item.end)) - 6
          : Math.max(yScale(item.start), yScale(item.end)) + 14;
      })
      .attr('fill', d => (d as CumulativeItem).bar.value >= 0 ? BAR_COLORS.positive : BAR_COLORS.negative)
      .attr('opacity', 1)
      .tween('text', function(d) {
        const item = d as CumulativeItem;
        const prefix = item.bar.value >= 0 ? '+' : '';
        const self = d3.select(this);
        return () => {
          self.text(prefix + formatValueRef.current(item.bar.value));
        };
      });

    // D3 event listeners for hover on bar rects
    merged.select<SVGRectElement>('.bar-rect')
      .on('mouseenter', function(event: MouseEvent, d: CumulativeItem) {
        d3.select(this).attr('opacity', 1);
        const content = tooltipContentRef.current?.(d.bar, false);
        showTooltipRef.current(event.clientX, event.clientY, content ?? null);
      })
      .on('mousemove', function(event: MouseEvent) {
        moveTooltipRef.current(event.clientX, event.clientY);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 0.85);
        hideTooltipRef.current();
      });

    // ── TOTAL BAR ──
    const totalBarGroup = chart.select<SVGGElement>('.total-bar-group');

    // Total bar data: single-element array with the total
    const totalBarData = cumulativeData.length > 0
      ? [{ label: totalLabel, value: total }]
      : [];

    const totalSel = totalBarGroup.selectAll<SVGRectElement, { label: string; value: number }>('.total-rect')
      .data(totalBarData, d => d.label);

    // Exit
    totalSel.exit()
      .interrupt()
      .transition()
      .duration(300)
      .attr('y', zeroY)
      .attr('height', 0)
      .attr('opacity', 0)
      .remove();

    // Enter
    const totalEnter = totalSel.enter()
      .append('rect')
      .attr('class', 'total-rect')
      .attr('x', xScale(totalLabel) ?? 0)
      .attr('y', zeroY)
      .attr('width', bandwidth)
      .attr('height', 0)
      .attr('fill', BAR_COLORS.total)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('opacity', 0.9)
      .style('cursor', 'pointer');

    // Merge + animate
    const totalBarDelay = isFirstRender ? cumulativeData.length * 80 + 100 : 0;

    totalEnter.merge(totalSel)
      .interrupt()
      .attr('opacity', 0.9)
      .transition()
      .duration(dur)
      .delay(totalBarDelay)
      .ease(d3.easeCubicOut)
      .attr('x', xScale(totalLabel) ?? 0)
      .attr('width', bandwidth)
      .attr('y', Math.min(yScale(0), yScale(total)))
      .attr('height', Math.max(Math.abs(yScale(total) - yScale(0)), 1))
      .attr('fill', BAR_COLORS.total);

    // Total bar hover events
    totalEnter.merge(totalSel)
      .on('mouseenter', function(event: MouseEvent) {
        d3.select(this).attr('opacity', 1);
        const totalBar: WaterfallBar = { label: totalLabel, value: total };
        const content = tooltipContentRef.current?.(totalBar, true);
        showTooltipRef.current(event.clientX, event.clientY, content ?? null);
      })
      .on('mousemove', function(event: MouseEvent) {
        moveTooltipRef.current(event.clientX, event.clientY);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 0.9);
        hideTooltipRef.current();
      });

    // Total value label
    const totalLabelSel = totalBarGroup.selectAll<SVGTextElement, { label: string; value: number }>('.total-label')
      .data(totalBarData, d => d.label);

    totalLabelSel.exit()
      .interrupt()
      .transition()
      .duration(200)
      .attr('opacity', 0)
      .remove();

    const totalLabelEnter = totalLabelSel.enter()
      .append('text')
      .attr('class', 'total-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .attr('fill', BAR_COLORS.total)
      .attr('opacity', 0);

    totalLabelEnter.merge(totalLabelSel)
      .interrupt()
      .transition()
      .duration(dur)
      .delay(isFirstRender ? totalBarDelay + 300 : 0)
      .ease(d3.easeCubicOut)
      .attr('x', (xScale(totalLabel) ?? 0) + bandwidth / 2)
      .attr('y', total >= 0
        ? Math.min(yScale(0), yScale(total)) - 6
        : Math.max(yScale(0), yScale(total)) + 14
      )
      .attr('opacity', 1)
      .tween('text', function() {
        const self = d3.select(this);
        return () => {
          self.text(formatValueRef.current(total));
        };
      });

    // ── CONNECTOR LINES ──
    const connectorsGroup = chart.select<SVGGElement>('.connectors');

    // Build connector data: between each bar pair, plus last bar to total
    interface ConnectorDatum {
      key: string;
      x1: number;
      x2: number;
      y: number;
    }

    const connectorData: ConnectorDatum[] = [];
    for (let i = 0; i < cumulativeData.length - 1; i++) {
      const item = cumulativeData[i];
      const nextItem = cumulativeData[i + 1];
      connectorData.push({
        key: `conn-${item.bar.label}-${nextItem.bar.label}`,
        x1: (xScale(item.bar.label) ?? 0) + bandwidth,
        x2: xScale(nextItem.bar.label) ?? 0,
        y: yScale(item.end),
      });
    }
    // Last bar to total
    if (cumulativeData.length > 0) {
      const lastItem = cumulativeData[cumulativeData.length - 1];
      connectorData.push({
        key: `conn-${lastItem.bar.label}-${totalLabel}`,
        x1: (xScale(lastItem.bar.label) ?? 0) + bandwidth,
        x2: xScale(totalLabel) ?? 0,
        y: yScale(lastItem.end),
      });
    }

    const connectors = connectorsGroup.selectAll<SVGLineElement, ConnectorDatum>('.connector')
      .data(connectorData, d => d.key);

    connectors.exit()
      .interrupt()
      .transition()
      .duration(200)
      .attr('opacity', 0)
      .remove();

    const connectorsEnter = connectors.enter()
      .append('line')
      .attr('class', 'connector')
      .attr('stroke', CONNECTOR_COLOR)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
      .attr('opacity', 0);

    connectorsEnter.merge(connectors)
      .interrupt()
      .transition()
      .duration(isFirstRender ? 300 : dur)
      .delay((_, i) => isFirstRender ? i * 80 + 400 : 0)
      .ease(d3.easeCubicOut)
      .attr('x1', d => d.x1)
      .attr('x2', d => d.x2)
      .attr('y1', d => d.y)
      .attr('y2', d => d.y)
      .attr('opacity', 1);

    // ── Y-AXIS ──
    const yAxisGroup = chart.select<SVGGElement>('.y-axis');
    const yAxisGen = d3.axisLeft(yScale)
      .ticks(6)
      .tickFormat(d => formatValueRef.current(d as number))
      .tickSizeOuter(0);

    if (isFirstRender || isNewData) {
      yAxisGroup
        .transition()
        .duration(isFirstRender ? 400 : dur)
        .call(yAxisGen as any);
    } else {
      yAxisGroup.call(yAxisGen as any);
    }

    // Style y-axis
    yAxisGroup.selectAll('text')
      .attr('fill', CHART_COLORS.onSurfaceVariant)
      .attr('font-size', '11px');
    yAxisGroup.selectAll('line, path')
      .attr('stroke', CHART_COLORS.outline);

    // ── X-AXIS ──
    const xAxisGroup = chart.select<SVGGElement>('.x-axis');
    xAxisGroup.attr('transform', `translate(0,${chartHeight})`);

    // Build x-axis manually for rotated labels
    const allLabels = [...cumulativeData.map(c => c.bar.label), totalLabel];

    const xTickSel = xAxisGroup.selectAll<SVGGElement, string>('.x-tick')
      .data(allLabels, d => d);

    xTickSel.exit()
      .interrupt()
      .transition()
      .duration(200)
      .attr('opacity', 0)
      .remove();

    const xTickEnter = xTickSel.enter()
      .append('g')
      .attr('class', 'x-tick')
      .attr('opacity', 0);

    xTickEnter.append('line')
      .attr('y2', 6)
      .attr('stroke', CHART_COLORS.outline);

    xTickEnter.append('text')
      .attr('y', 12)
      .attr('text-anchor', 'end')
      .attr('transform', 'rotate(-35)')
      .attr('font-size', 11);

    const xTickMerged = xTickEnter.merge(xTickSel);

    xTickMerged
      .interrupt()
      .transition()
      .duration(isFirstRender ? 400 : dur)
      .delay(isFirstRender ? 200 : 0)
      .attr('transform', d => `translate(${(xScale(d) ?? 0) + bandwidth / 2},0)`)
      .attr('opacity', 1);

    xTickMerged.select('text')
      .text(d => d)
      .attr('fill', d => d === totalLabel ? BAR_COLORS.total : CHART_COLORS.onSurfaceVariant)
      .attr('font-weight', d => d === totalLabel ? 700 : 400);

    // X-axis baseline
    xAxisGroup.selectAll('.x-axis-line').remove();
    xAxisGroup.append('line')
      .attr('class', 'x-axis-line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', CHART_COLORS.outline);

    // Mark that initial animation has run
    if (isFirstRender) {
      hasAnimatedIn.current = true;
    }

  }, [
    bars, cumulativeData, total, totalLabel, totalValue,
    xScale, yScale, chartWidth, chartHeight,
    margins, title,
  ]);

  // Empty state
  if (!bars || bars.length === 0) {
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
      />
      <D3Tooltip {...tooltip} />
    </div>
  );
};

export default WaterfallChart;
