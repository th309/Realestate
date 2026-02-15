'use client';

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useD3Tooltip, D3Tooltip, useResponsiveD3 } from './hooks/useD3';
import { PlaybackControls } from './PlaybackControls';
import { CHART_COLORS } from './utils/scales';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BarEntry {
  id: string;
  label: string;
  value: number;
  highlighted?: boolean;
}

/** A single frame in a bar-chart-race animation. */
export interface BarRaceFrame {
  date: string; // e.g. "2024-01"
  entries: BarEntry[];
}

export interface HorizontalBarChartProps {
  /* ---------- static mode (existing) ---------- */
  data: BarEntry[];
  benchmarkValue?: number;
  benchmarkLabel?: string;
  formatValue?: (v: number) => string;
  height?: number;
  className?: string;
  onBarClick?: (entry: BarEntry) => void;
  highlightColor?: string;
  barColor?: string;

  /* ---------- bar chart race mode (new) ---------- */
  /** If provided, enables bar-chart-race mode. */
  raceFrames?: BarRaceFrame[];
  /** Start playing automatically (default false). */
  autoPlay?: boolean;
  /** Milliseconds per frame (default 800). */
  playbackSpeed?: number;
  /** Called whenever the visible frame changes. */
  onFrameChange?: (frameIndex: number, date: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const defaultFormatValue = (v: number): string => v.toLocaleString();

/**
 * Shorten a metro name to its first city + state abbreviation(s).
 *   "Washington-Arlington-Alexandria, DC-VA-MD-WV"  → "Washington, DC-VA-MD-WV"
 *   "Kill Devil Hills-Nags Head, NC"                → "Kill Devil Hills, NC"
 *   "Hilton Head Island-Bluffton, SC"               → "Hilton Head Island, SC"
 *   "Cook County, IL"                               → "Cook County, IL"
 */
function shortenLabel(label: string): string {
  const commaIdx = label.lastIndexOf(',');
  if (commaIdx === -1) return label; // no state suffix — return as-is
  const states = label.slice(commaIdx); // ", DC-VA-MD-WV"
  const cityPart = label.slice(0, commaIdx); // "Washington-Arlington-Alexandria"
  const firstCity = cityPart.split('-')[0].trim(); // "Washington"
  return firstCity + states;
}

const BASE_MARGINS = { top: 24, right: 80, bottom: 40, left: 200 };

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  data,
  benchmarkValue,
  benchmarkLabel,
  formatValue = defaultFormatValue,
  height: heightProp,
  className = '',
  onBarClick,
  highlightColor = CHART_COLORS.highlight,
  barColor = CHART_COLORS.primary,

  raceFrames,
  autoPlay = false,
  playbackSpeed = 800,
  onFrameChange,
}) => {
  /* ---------- mode flag ---------- */
  const isRaceMode = Boolean(raceFrames && raceFrames.length > 0);

  /* ---------- dimensions ---------- */
  // Race controls height reservation (play bar + scrubber + gap)
  const RACE_CONTROLS_HEIGHT = isRaceMode ? 48 : 0;

  const { containerRef, width, height: responsiveHeight } = useResponsiveD3<HTMLDivElement>(
    16 / 9,
    200,
    true, // fill container height
  );

  // Total height from the container, minus space for race controls
  const computedHeight = Math.max(200, (responsiveHeight || 400) - RACE_CONTROLS_HEIGHT);

  const { tooltip, showTooltip, hideTooltip, moveTooltip } = useD3Tooltip();

  // Adaptive sizing based on bar count
  const barCount = isRaceMode
    ? Math.max(...(raceFrames?.map(f => f.entries.length) ?? [10]), 10)
    : data.length;
  const isCompact = barCount > 15;
  const MARGINS = {
    ...BASE_MARGINS,
    left: isCompact ? 170 : BASE_MARGINS.left,
    top: isCompact ? 16 : BASE_MARGINS.top,
    bottom: isCompact ? 32 : BASE_MARGINS.bottom,
  };
  const labelFontSize = isCompact ? 10 : 12;
  const valueFontSize = isCompact ? 9 : 11;

  const effectiveWidth = width || 600;
  const chartWidth = effectiveWidth - MARGINS.left - MARGINS.right;
  const chartHeight = computedHeight - MARGINS.top - MARGINS.bottom;

  /* ---------- refs ---------- */
  const svgRef = useRef<SVGSVGElement>(null);
  // Store callbacks in refs so the D3 effect doesn't re-run on every render
  const formatRef = useRef(formatValue);
  formatRef.current = formatValue;
  const onBarClickRef = useRef(onBarClick);
  onBarClickRef.current = onBarClick;
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;
  const highlightColorRef = useRef(highlightColor);
  highlightColorRef.current = highlightColor;
  const barColorRef = useRef(barColor);
  barColorRef.current = barColor;

  const rankColorScale = useMemo(() => {
    return d3.scaleLinear<string>()
      .domain([0, Math.max(data.length - 1, 1)])
      .range([CHART_COLORS.primary, '#4f46e5'])
      .interpolate(d3.interpolateHcl);
  }, [data.length]);

  const rankColorRef = useRef(rankColorScale);
  rankColorRef.current = rankColorScale;

  /* ================================================================ */
  /*  RACE MODE STATE                                                   */
  /* ================================================================ */

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [speed, setSpeed] = useState(playbackSpeed);
  const [currentDate, setCurrentDate] = useState(
    raceFrames && raceFrames.length > 0 ? raceFrames[0].date : '',
  );
  const frameRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const renderFrameRef = useRef<(idx: number) => void>(undefined);

  /* ================================================================ */
  /*  STATIC MODE — imperative D3                                       */
  /* ================================================================ */

  useEffect(() => {
    if (isRaceMode) return; // handled separately
    if (!svgRef.current || !data || data.length === 0) return;
    if (chartWidth <= 0 || chartHeight <= 0) return;

    const svg = d3.select(svgRef.current);

    // Interrupt any in-flight transitions then reset opacity
    svg.selectAll('*').interrupt();
    svg.attr('opacity', 1);

    // Clear previous content
    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGINS.left},${MARGINS.top})`);

    /* ---- scales ---- */
    const maxValue = d3.max(data, (d) => d.value) ?? 0;
    const domainMax =
      benchmarkValue !== undefined ? Math.max(maxValue, benchmarkValue) : maxValue;

    const xScale = d3
      .scaleLinear()
      .domain([0, domainMax])
      .range([0, chartWidth])
      .nice();

    const yScale = d3
      .scaleBand()
      .domain(data.map((d) => d.id))
      .range([0, chartHeight])
      .padding(isCompact ? 0.12 : 0.2);

    // Faster stagger for many bars so animation doesn't drag
    const staggerDelay = isCompact ? 25 : 50;

    /* ---- grid lines ---- */
    const gridG = g.append('g').attr('class', 'grid-lines').attr('opacity', 0.3);
    xScale.ticks(6).forEach((tick) => {
      gridG
        .append('line')
        .attr('x1', xScale(tick))
        .attr('x2', xScale(tick))
        .attr('y1', 0)
        .attr('y2', chartHeight)
        .attr('stroke', CHART_COLORS.outlineVariant)
        .attr('stroke-dasharray', '2,2');
    });

    /* ---- bars with entrance animation ---- */
    const barsG = g.append('g').attr('class', 'bars-group');

    const barGroups = barsG
      .selectAll<SVGGElement, BarEntry>('.bar-group')
      .data(data, (d) => d.id)
      .enter()
      .append('g')
      .attr('class', 'bar-group');

    // rect — animate width from 0
    barGroups
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => yScale(d.id) ?? 0)
      .attr('width', 0) // start collapsed
      .attr('height', yScale.bandwidth())
      .attr('fill', (d, i) => d.highlighted ? highlightColorRef.current : rankColorRef.current(i))
      .attr('rx', 4)
      .attr('ry', 4)
      .style('opacity', 0.85)
      .style('cursor', onBarClick ? 'pointer' : 'default')
      .on('mouseenter', function (event: MouseEvent, d: BarEntry) {
        d3.select(this).style('opacity', 1);
        const content = `<div class="min-w-[140px]"><div class="font-semibold text-sm border-b border-white/20 pb-1 mb-1.5">${d.label}</div><div class="text-xs"><span class="font-medium">${formatRef.current(d.value)}</span></div>${onBarClickRef.current ? '<div class="text-[10px] opacity-60 mt-2 pt-1 border-t border-white/20">Click for details</div>' : ''}</div>`;
        showTooltip(event.clientX, event.clientY, <span dangerouslySetInnerHTML={{ __html: content }} />);
      })
      .on('mousemove', function (event: MouseEvent) {
        moveTooltip(event.clientX, event.clientY);
      })
      .on('mouseleave', function () {
        d3.select(this).style('opacity', 0.85);
        hideTooltip();
      })
      .on('click', function (_event: MouseEvent, d: BarEntry) {
        onBarClickRef.current?.(d);
      })
      .transition()
      .duration(500)
      .delay((_d, i) => i * staggerDelay)
      .attr('width', (d) => Math.max(0, xScale(d.value)));

    // left label — fade in with bar
    barGroups
      .append('text')
      .attr('x', -8)
      .attr('y', (d) => (yScale(d.id) ?? 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('fill', CHART_COLORS.onSurface)
      .attr('font-size', labelFontSize)
      .attr('font-weight', (d) => (d.highlighted ? 600 : 400))
      .text((d) => shortenLabel(d.label))
      .attr('opacity', 0)
      .transition()
      .duration(500)
      .delay((_d, i) => i * staggerDelay)
      .attr('opacity', 1);

    // right value label — fade in with bar
    barGroups
      .append('text')
      .attr('class', 'bar-value')
      .attr('x', 6)
      .attr('y', (d) => (yScale(d.id) ?? 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'start')
      .attr('fill', CHART_COLORS.onSurfaceVariant)
      .attr('font-size', valueFontSize)
      .attr('font-weight', 500)
      .text((d) => formatRef.current(d.value))
      .attr('opacity', 0)
      .transition()
      .duration(500)
      .delay((_d, i) => i * staggerDelay)
      .attr('opacity', 1)
      .attr('x', (d) => Math.max(0, xScale(d.value)) + 6);

    /* ---- benchmark line (draw top→bottom after bars) ---- */
    if (benchmarkValue !== undefined) {
      const totalBarDelay = data.length * staggerDelay + 500;
      const bx = xScale(benchmarkValue);

      const benchLine = g
        .append('line')
        .attr('x1', bx)
        .attr('x2', bx)
        .attr('y1', 0)
        .attr('y2', 0) // start collapsed
        .attr('stroke', '#6b7280')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 4');

      benchLine
        .transition()
        .delay(totalBarDelay)
        .duration(400)
        .attr('y2', chartHeight);

      if (benchmarkLabel) {
        g.append('text')
          .attr('x', bx)
          .attr('y', -8)
          .attr('text-anchor', 'middle')
          .attr('fill', '#6b7280')
          .attr('font-size', 11)
          .attr('font-weight', 500)
          .text(benchmarkLabel)
          .attr('opacity', 0)
          .transition()
          .delay(totalBarDelay)
          .duration(400)
          .attr('opacity', 1);
      }
    }

    /* ---- axes ---- */
    // x axis
    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${chartHeight})`);

    xAxisG
      .append('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('stroke', CHART_COLORS.outline);

    xScale.ticks(6).forEach((tick) => {
      const tickG = xAxisG
        .append('g')
        .attr('transform', `translate(${xScale(tick)},0)`);

      tickG.append('line').attr('y2', 6).attr('stroke', CHART_COLORS.outline);

      tickG
        .append('text')
        .attr('y', isCompact ? 16 : 20)
        .attr('text-anchor', 'middle')
        .attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('font-size', valueFontSize)
        .text(formatRef.current(tick));
    });

    // left axis line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', CHART_COLORS.outline);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data,
    benchmarkValue,
    benchmarkLabel,
    chartWidth,
    chartHeight,
    effectiveWidth,
    computedHeight,
    isRaceMode,
    highlightColor,
    barColor,
  ]);

  /* ================================================================ */
  /*  RACE MODE — imperative D3                                         */
  /* ================================================================ */

  useEffect(() => {
    if (!isRaceMode) return;
    if (!svgRef.current || !raceFrames || raceFrames.length === 0) return;
    if (chartWidth <= 0 || chartHeight <= 0) return;

    const svg = d3.select(svgRef.current);

    // Interrupt any in-flight transitions then reset opacity
    svg.selectAll('*').interrupt();
    svg.attr('opacity', 1);
    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGINS.left},${MARGINS.top})`);

    // Groups
    const gridG = g.append('g').attr('class', 'race-grid').attr('opacity', 0.3);
    const barsGroup = g.append('g').attr('class', 'race-bars');

    // Show all bars from the data — scaleBand handles sizing
    const maxBars = Math.max(
      ...raceFrames.map((f) => f.entries.length),
      10,
    );

    const raceRankScale = d3.scaleLinear<string>()
      .domain([0, maxBars - 1])
      .range([CHART_COLORS.primary, '#4f46e5'])
      .interpolate(d3.interpolateHcl);

    // Scales — both updated per frame, but x transitions smoothly
    const xScale = d3.scaleLinear().range([0, chartWidth]);
    const yScale = d3
      .scaleBand<string>()
      .range([0, chartHeight])
      .padding(isCompact ? 0.12 : 0.15);

    // x-axis group (will be smoothly transitioned)
    const xAxisG = g
      .append('g')
      .attr('class', 'race-x-axis')
      .attr('transform', `translate(0,${chartHeight})`);

    // Create a D3 axis generator for smooth transitions
    const xAxis = d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat((d) => formatRef.current(d as number))
      .tickSize(6);

    // left axis line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', CHART_COLORS.outline);

    // Helper to update grid + axis with smooth transition
    function updateXAxis(duration: number) {
      // Transition the D3 axis
      (xAxisG as any)
        .transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .call(xAxis);

      // Style axis (applied after transition completes too)
      xAxisG.selectAll('.domain').attr('stroke', CHART_COLORS.outline);
      xAxisG.selectAll('.tick line').attr('stroke', CHART_COLORS.outline);
      xAxisG.selectAll('.tick text')
        .attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('font-size', valueFontSize);

      // Transition grid lines
      const ticks = xScale.ticks(5);
      const gridLines = gridG
        .selectAll<SVGLineElement, number>('.grid-line')
        .data(ticks, (d) => d);

      gridLines.enter()
        .append('line')
        .attr('class', 'grid-line')
        .attr('x1', (d) => xScale(d))
        .attr('x2', (d) => xScale(d))
        .attr('y1', 0)
        .attr('y2', chartHeight)
        .attr('stroke', CHART_COLORS.outlineVariant)
        .attr('stroke-dasharray', '2,2')
        .attr('opacity', 0)
        .transition()
        .duration(duration)
        .attr('opacity', 1);

      gridLines
        .transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .attr('x1', (d) => xScale(d))
        .attr('x2', (d) => xScale(d));

      gridLines.exit()
        .transition()
        .duration(duration / 2)
        .attr('opacity', 0)
        .remove();
    }

    /* ---- renderFrame ---- */
    function renderFrame(frameIdx: number) {
      const frame = raceFrames![frameIdx];
      if (!frame) return;

      const sorted = [...frame.entries]
        .sort((a, b) => b.value - a.value)
        .slice(0, maxBars);

      // Update both scale domains
      const maxVal = d3.max(sorted, (d) => d.value) || 1;
      xScale.domain([0, maxVal]).nice();
      yScale.domain(sorted.map((d) => d.id));

      const transitionDuration = speed * 0.8;

      // Smoothly transition x-axis and grid
      updateXAxis(transitionDuration);

      /* -- data join -- */
      const bars = barsGroup
        .selectAll<SVGGElement, BarEntry>('.race-bar')
        .data(sorted, (d) => d.id);

      /* ENTER */
      const enter = bars
        .enter()
        .append('g')
        .attr('class', 'race-bar')
        .attr('transform', `translate(0,${chartHeight})`); // start below

      enter
        .append('rect')
        .attr('height', yScale.bandwidth())
        .attr('width', 0)
        .attr('fill', (d, i) =>
          d.highlighted ? highlightColorRef.current : raceRankScale(i),
        )
        .attr('rx', 4)
        .attr('ry', 4)
        .style('opacity', 0.85)
        .on('mouseenter', function (event: MouseEvent, d: BarEntry) {
          d3.select(this).style('opacity', 1);
          showTooltip(
            event.clientX,
            event.clientY,
            <span>{d.label}: {formatRef.current(d.value)}</span>,
          );
        })
        .on('mousemove', function (event: MouseEvent) {
          moveTooltip(event.clientX, event.clientY);
        })
        .on('mouseleave', function () {
          d3.select(this).style('opacity', 0.85);
          hideTooltip();
        });

      // bar label (market name, left of bar)
      enter
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', -8)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('fill', CHART_COLORS.onSurface)
        .attr('font-size', labelFontSize)
        .attr('font-weight', (d) => (d.highlighted ? 600 : 400))
        .text((d) => shortenLabel(d.label));

      // value label
      enter
        .append('text')
        .attr('class', 'bar-value')
        .attr('x', 6)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'start')
        .attr('fill', CHART_COLORS.onSurfaceVariant)
        .attr('font-size', valueFontSize)
        .attr('font-weight', 500)
        .text((d) => formatRef.current(d.value));

      /* ENTER + UPDATE (merged) */
      const merged = enter.merge(bars);

      // Animate group position (y reorder)
      merged
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeLinear)
        .attr('transform', (d) => `translate(0,${yScale(d.id) ?? 0})`);

      // Animate rect width + height
      merged
        .select('rect')
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeLinear)
        .attr('width', (d) => Math.max(0, xScale(d.value)))
        .attr('height', yScale.bandwidth())
        .attr('fill', (d, i) =>
          d.highlighted ? highlightColorRef.current : raceRankScale(i),
        );

      // Position label text at center of band
      merged
        .select('.bar-label')
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeLinear)
        .attr('y', yScale.bandwidth() / 2)
        .attr('font-size', labelFontSize)
        .attr('font-weight', (d: BarEntry) => (d.highlighted ? 600 : 400))
        .text((d: BarEntry) => shortenLabel(d.label));

      // Value label — animate position + counter
      merged
        .select<SVGTextElement>('.bar-value')
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeLinear)
        .attr('x', (d: BarEntry) => Math.max(0, xScale(d.value)) + 6)
        .attr('y', yScale.bandwidth() / 2)
        .tween('text', function (d: BarEntry) {
          const node = this as SVGTextElement;
          const prev = parseFloat(node.textContent?.replace(/[^0-9.\-]/g, '') || '0');
          const interp = d3.interpolateNumber(prev, d.value);
          return (t: number) => {
            node.textContent = formatRef.current(interp(t));
          };
        });

      /* EXIT */
      bars
        .exit<BarEntry>()
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeLinear)
        .attr('transform', `translate(0,${chartHeight + 50})`)
        .style('opacity', 0)
        .remove();

      // Update React state for the date label
      setCurrentDate(frame.date);
    }

    // Store renderFrame so the playback loop can call it
    renderFrameRef.current = renderFrame;

    // Render initial frame
    renderFrame(frameRef.current);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    raceFrames,
    chartWidth,
    chartHeight,
    effectiveWidth,
    computedHeight,
    isRaceMode,
    speed,
  ]);

  /* ---- playback loop ---- */
  useEffect(() => {
    if (!isPlaying || !isRaceMode || !raceFrames || raceFrames.length === 0)
      return;

    timerRef.current = setInterval(() => {
      frameRef.current += 1;
      if (frameRef.current >= raceFrames.length) {
        frameRef.current = 0; // loop
      }
      setCurrentFrame(frameRef.current);
      renderFrameRef.current?.(frameRef.current);
      onFrameChangeRef.current?.(
        frameRef.current,
        raceFrames[frameRef.current].date,
      );
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, raceFrames, isRaceMode]);

  /* ---- playback helpers ---- */
  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const seekToFrame = useCallback(
    (idx: number) => {
      frameRef.current = idx;
      setCurrentFrame(idx);
      renderFrameRef.current?.(idx);
      if (raceFrames) {
        onFrameChangeRef.current?.(idx, raceFrames[idx].date);
      }
    },
    [raceFrames],
  );

  /* ================================================================ */
  /*  EMPTY STATE                                                       */
  /* ================================================================ */

  if (
    (!data || data.length === 0) &&
    (!raceFrames || raceFrames.length === 0)
  ) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-surface-container rounded-2xl h-full ${className}`}
      >
        <p className="text-on-surface-variant">No data available</p>
      </div>
    );
  }

  /* ================================================================ */
  /*  RENDER                                                            */
  /* ================================================================ */

  return (
    <div ref={containerRef} className={`relative h-full ${className}`}>
      <svg
        ref={svgRef}
        width={effectiveWidth}
        height={computedHeight}
        className="overflow-visible"
      />

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

export default HorizontalBarChart;
