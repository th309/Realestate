'use client';

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useD3Tooltip, D3Tooltip, useResponsiveD3 } from './hooks/useD3';
import { CHART_COLORS } from './utils/scales';
import { PlaybackControls } from './PlaybackControls';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RadarDataSet {
  label: string;
  color: string;
  values: Record<string, number>; // dimension key -> 0-100 percentile value
}

export interface RadarDimension {
  key: string;
  label: string;
  description?: string;
  /** Actual metric ID for data fetching (may differ from key) */
  metricId?: string;
  /** Override metric ID for race mode time series (when the primary metricId lacks time series data) */
  raceMetricId?: string;
  /** When true, lower raw values produce higher percentile scores */
  invert?: boolean;
}

export interface RadarChartProps {
  datasets: RadarDataSet[];       // 1-3 overlaid datasets
  dimensions: RadarDimension[];   // 4-8 axes
  height?: number;
  className?: string;
  showLabels?: boolean;
  showValues?: boolean;
  /** Race mode frames — if provided, enables time animation */
  raceFrames?: { date: string; datasets: RadarDataSet[] }[];
  /** Auto-play on mount (default false) */
  autoPlay?: boolean;
  /** Ms per frame (default 800) */
  playbackSpeed?: number;
  /** Called when frame changes */
  onFrameChange?: (frameIndex: number, date: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_COLORS = ['#0891b2', '#3b82f6', '#ea580c'];
const RING_VALUES = [20, 40, 60, 80, 100];
const LABEL_PADDING = 24; // px outside the outermost ring

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the angle (in radians) for dimension index `i` out of `total`. */
function dimensionAngle(i: number, total: number): number {
  return (2 * Math.PI * i) / total - Math.PI / 2; // start from top
}

/** Convert a polar-style value to an SVG coordinate. */
function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  value: number,
  angle: number
): { x: number; y: number } {
  const r = radius * (value / 100);
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/** Build an SVG polygon path string for a dataset. */
function buildPolygonPath(
  cx: number,
  cy: number,
  radius: number,
  values: number[],
  total: number
): string {
  return values
    .map((v, i) => {
      const angle = dimensionAngle(i, total);
      const { x, y } = polarToCartesian(cx, cy, radius, v, angle);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ') + ' Z';
}

/** Build the ring (concentric polygon) path at a given percentile. */
function buildRingPath(
  cx: number,
  cy: number,
  radius: number,
  percentile: number,
  total: number
): string {
  const points = Array.from({ length: total }, (_, i) => {
    const angle = dimensionAngle(i, total);
    const { x, y } = polarToCartesian(cx, cy, radius, percentile, angle);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  });
  return points.join(' ') + ' Z';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RadarChart: React.FC<RadarChartProps> = ({
  datasets,
  dimensions,
  height = 400,
  className = '',
  showLabels = true,
  showValues = false,
  raceFrames,
  autoPlay = false,
  playbackSpeed = 800,
  onFrameChange,
}) => {
  const { containerRef, width, height: responsiveHeight } =
    useResponsiveD3<HTMLDivElement>(1, height, true);
  const { tooltip, showTooltip, hideTooltip, moveTooltip } = useD3Tooltip();
  const svgRef = useRef<SVGSVGElement>(null);

  // Keep refs for tooltip functions so D3 event handlers always see latest
  const showTooltipRef = useRef(showTooltip);
  const hideTooltipRef = useRef(hideTooltip);
  const moveTooltipRef = useRef(moveTooltip);
  useEffect(() => { showTooltipRef.current = showTooltip; }, [showTooltip]);
  useEffect(() => { hideTooltipRef.current = hideTooltip; }, [hideTooltip]);
  useEffect(() => { moveTooltipRef.current = moveTooltip; }, [moveTooltip]);

  // ── Race mode state ──
  const isRaceMode = Boolean(raceFrames && raceFrames.length > 0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [raceSpeed, setRaceSpeed] = useState(playbackSpeed);
  const [currentDate, setCurrentDate] = useState(raceFrames?.[0]?.date ?? '');
  const raceFrameRef = useRef(0);
  const raceTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const renderRaceFrameRef = useRef<(idx: number) => void>(undefined);
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  const playbackControlsHeight = isRaceMode ? 44 : 0;
  const effectiveHeight = (responsiveHeight || height) - playbackControlsHeight;
  const effectiveWidth = width || 400;

  // Reserve space for legend below the chart
  const legendHeight = 36;
  const chartAreaHeight = effectiveHeight - legendHeight;

  // Radius = half of the smallest dimension, minus label padding
  const radius = useMemo(() => {
    const side = Math.min(effectiveWidth, chartAreaHeight);
    return Math.max(side / 2 - LABEL_PADDING - 40, 40); // 40px extra for text
  }, [effectiveWidth, chartAreaHeight]);

  const cx = effectiveWidth / 2;
  const cy = chartAreaHeight / 2;

  // Assign default colors where needed
  const coloredDatasets = useMemo(
    () =>
      datasets.map((ds, i) => ({
        ...ds,
        color: ds.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      })),
    [datasets]
  );

  // Pre-compute ordered values for each dataset (in dimension order)
  const orderedValues = useMemo(
    () =>
      coloredDatasets.map((ds) =>
        dimensions.map((dim) => {
          const v = ds.values[dim.key];
          return typeof v === 'number' ? Math.max(0, Math.min(100, v)) : 0;
        })
      ),
    [coloredDatasets, dimensions]
  );

  // Polygon paths
  const polygonPaths = useMemo(
    () =>
      orderedValues.map((vals) =>
        buildPolygonPath(cx, cy, radius, vals, dimensions.length)
      ),
    [orderedValues, cx, cy, radius, dimensions.length]
  );

  // Track whether this is the initial render vs a data update
  const isInitialRender = useRef(true);

  // -----------------------------------------------------------------------
  // Main imperative D3 useEffect
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!svgRef.current || !dimensions || dimensions.length < 3 || !datasets || datasets.length === 0) return;
    if (!effectiveWidth || !chartAreaHeight) return;

    const svg = d3.select(svgRef.current);
    const isFirstRender = isInitialRender.current;

    // ------- Scaffold groups -------
    let chart = svg.select<SVGGElement>('.chart-group');
    if (chart.empty()) {
      svg.selectAll('*').remove();
      chart = svg.append('g').attr('class', 'chart-group');
      chart.append('g').attr('class', 'rings-group');
      chart.append('g').attr('class', 'ring-labels-group');
      chart.append('g').attr('class', 'axes-group');
      chart.append('g').attr('class', 'dim-labels-group');
      chart.append('g').attr('class', 'polygons-group');
      chart.append('g').attr('class', 'vertices-group');
      chart.append('g').attr('class', 'value-labels-group');
    }

    const ringsGroup = chart.select<SVGGElement>('.rings-group');
    const ringLabelsGroup = chart.select<SVGGElement>('.ring-labels-group');
    const axesGroup = chart.select<SVGGElement>('.axes-group');
    const dimLabelsGroup = chart.select<SVGGElement>('.dim-labels-group');
    const polygonsGroup = chart.select<SVGGElement>('.polygons-group');
    const verticesGroup = chart.select<SVGGElement>('.vertices-group');
    const valueLabelsGroup = chart.select<SVGGElement>('.value-labels-group');

    const total = dimensions.length;

    // ------- Ring paths -------
    const ringPathData = RING_VALUES.map((pct) => ({
      pct,
      d: buildRingPath(cx, cy, radius, pct, total),
    }));

    const rings = ringsGroup
      .selectAll<SVGPathElement, typeof ringPathData[0]>('.ring')
      .data(ringPathData, (d) => String(d.pct));

    rings.exit().remove();

    const ringsEnter = rings
      .enter()
      .append('path')
      .attr('class', 'ring')
      .attr('fill', 'none')
      .attr('stroke', (d) => (d.pct === 100 ? '#d1d5db' : '#e5e7eb'))
      .attr('stroke-width', (d) => (d.pct === 100 ? 1.5 : 1));

    if (isFirstRender) {
      ringsEnter
        .attr('opacity', 0)
        .attr('d', (d) => d.d)
        .transition()
        .duration(300)
        .delay((_, i) => i * 60)
        .attr('opacity', 1);
    } else {
      ringsEnter.attr('opacity', 1).attr('d', (d) => d.d);
    }

    rings.merge(ringsEnter)
      .interrupt()
      .attr('opacity', 1)
      .attr('stroke', (d) => (d.pct === 100 ? '#d1d5db' : '#e5e7eb'))
      .attr('stroke-width', (d) => (d.pct === 100 ? 1.5 : 1))
      .transition()
      .duration(300)
      .attr('d', (d) => d.d);

    // ------- Ring value labels -------
    const ringLabelData = RING_VALUES.map((pct) => {
      const angle = dimensionAngle(0, total);
      const { x, y } = polarToCartesian(cx, cy, radius, pct, angle);
      return { pct, x: x + 4, y: y - 4 };
    });

    const ringLabels = ringLabelsGroup
      .selectAll<SVGTextElement, typeof ringLabelData[0]>('.ring-label')
      .data(ringLabelData, (d) => String(d.pct));

    ringLabels.exit().remove();

    const ringLabelsEnter = ringLabels
      .enter()
      .append('text')
      .attr('class', 'ring-label')
      .attr('font-size', 9)
      .attr('fill', CHART_COLORS.onSurfaceVariant)
      .attr('opacity', 0.5)
      .text((d) => String(d.pct));

    if (isFirstRender) {
      ringLabelsEnter
        .attr('x', (d) => d.x)
        .attr('y', (d) => d.y)
        .attr('opacity', 0)
        .transition()
        .duration(300)
        .delay(300)
        .attr('opacity', 0.5);
    } else {
      ringLabelsEnter.attr('x', (d) => d.x).attr('y', (d) => d.y).attr('opacity', 0.5);
    }

    ringLabels.merge(ringLabelsEnter)
      .interrupt()
      .transition()
      .duration(300)
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y);

    // ------- Axis lines (draw in from center outward) -------
    const axisData = dimensions.map((_, i) => {
      const angle = dimensionAngle(i, total);
      const end = polarToCartesian(cx, cy, radius, 100, angle);
      return { x1: cx, y1: cy, x2: end.x, y2: end.y, index: i };
    });

    const axes = axesGroup
      .selectAll<SVGLineElement, typeof axisData[0]>('.axis-line')
      .data(axisData, (d) => String(d.index));

    axes.exit().remove();

    const axesEnter = axes
      .enter()
      .append('line')
      .attr('class', 'axis-line')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    if (isFirstRender) {
      axesEnter.each(function (d) {
        const el = d3.select(this);
        el.attr('x1', d.x1)
          .attr('y1', d.y1)
          .attr('x2', d.x2)
          .attr('y2', d.y2);

        // Compute line length for stroke-dasharray trick
        const dx = d.x2 - d.x1;
        const dy = d.y2 - d.y1;
        const len = Math.sqrt(dx * dx + dy * dy);

        el.attr('stroke-dasharray', `${len}`)
          .attr('stroke-dashoffset', `${len}`)
          .transition()
          .duration(400)
          .delay(150)
          .ease(d3.easeLinear)
          .attr('stroke-dashoffset', '0');
      });
    } else {
      axesEnter
        .attr('x1', (d) => d.x1)
        .attr('y1', (d) => d.y1)
        .attr('x2', (d) => d.x2)
        .attr('y2', (d) => d.y2);
    }

    axes.merge(axesEnter)
      .interrupt()
      .attr('stroke-dasharray', null)
      .attr('stroke-dashoffset', null)
      .transition()
      .duration(300)
      .attr('x1', (d) => d.x1)
      .attr('y1', (d) => d.y1)
      .attr('x2', (d) => d.x2)
      .attr('y2', (d) => d.y2);

    // ------- Dimension labels -------
    const labelData = dimensions.map((dim, i) => {
      const angle = dimensionAngle(i, total);
      const dist = radius + LABEL_PADDING;
      const x = cx + dist * Math.cos(angle);
      const y = cy + dist * Math.sin(angle);

      // Smart text-anchor based on angle
      const angleDeg = (angle * 180) / Math.PI;
      let textAnchor: 'start' | 'middle' | 'end' = 'middle';
      if (angleDeg > 10 && angleDeg < 170) textAnchor = 'start';
      else if (angleDeg > -170 && angleDeg < -10) textAnchor = 'end';
      if (Math.abs(angleDeg + 90) < 15) textAnchor = 'middle'; // top
      if (Math.abs(angleDeg - 90) < 15) textAnchor = 'middle'; // bottom

      // Vertical nudge
      let dy = '0.35em';
      if (angleDeg < -60 && angleDeg > -120) dy = '0em'; // top
      if (angleDeg > 60 && angleDeg < 120) dy = '0.8em'; // bottom

      return { x, y, textAnchor, dy, label: dim.label, description: dim.description, index: i };
    });

    if (showLabels) {
      const dimLabels = dimLabelsGroup
        .selectAll<SVGTextElement, typeof labelData[0]>('.dim-label')
        .data(labelData, (d) => String(d.index));

      dimLabels.exit().remove();

      const dimLabelsEnter = dimLabels
        .enter()
        .append('text')
        .attr('class', 'dim-label')
        .attr('font-size', 12)
        .attr('font-weight', 500)
        .attr('fill', CHART_COLORS.onSurface)
        .style('cursor', (d) => d.description ? 'help' : 'default')
        .text((d) => d.label);

      if (isFirstRender) {
        dimLabelsEnter
          .attr('x', (d) => d.x)
          .attr('y', (d) => d.y)
          .attr('text-anchor', (d) => d.textAnchor)
          .attr('dy', (d) => d.dy)
          .attr('opacity', 0)
          .transition()
          .duration(300)
          .delay(550) // after axes draw in
          .attr('opacity', 1);
      } else {
        dimLabelsEnter
          .attr('opacity', 1)
          .attr('text-anchor', (d) => d.textAnchor)
          .attr('dy', (d) => d.dy);
      }

      const merged = dimLabels.merge(dimLabelsEnter);
      merged
        .interrupt()
        .attr('opacity', 1)
        .text((d) => d.label)
        .style('cursor', (d) => d.description ? 'help' : 'default')
        .attr('text-anchor', (d) => d.textAnchor)
        .attr('dy', (d) => d.dy)
        .transition()
        .duration(300)
        .attr('x', (d) => d.x)
        .attr('y', (d) => d.y);

      // Dimension label hover → show description tooltip
      merged
        .on('mouseenter', function (event, d) {
          if (!d.description) return;
          d3.select(this).attr('text-decoration', 'underline');
          const html = `<div style="max-width:200px">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px">${d.label}</div>
            <div style="font-size:12px;opacity:0.85">${d.description}</div>
          </div>`;
          showTooltipRef.current(
            (event as MouseEvent).clientX,
            (event as MouseEvent).clientY,
            <div dangerouslySetInnerHTML={{ __html: html }} />
          );
        })
        .on('mousemove', function (event) {
          moveTooltipRef.current(
            (event as MouseEvent).clientX,
            (event as MouseEvent).clientY
          );
        })
        .on('mouseleave', function () {
          d3.select(this).attr('text-decoration', 'none');
          hideTooltipRef.current();
        });
    } else {
      dimLabelsGroup.selectAll('.dim-label').remove();
    }

    // ------- Polygon paths (datasets) -------
    const collapsedPath = buildPolygonPath(
      cx, cy, radius,
      new Array(total).fill(0),
      total
    );

    const polygonData = coloredDatasets.map((ds, i) => ({
      ...ds,
      index: i,
      path: polygonPaths[i],
    }));

    const polygons = polygonsGroup
      .selectAll<SVGPathElement, typeof polygonData[0]>('.polygon')
      .data(polygonData, (d) => String(d.index));

    polygons.exit().remove();

    const polygonsEnter = polygons
      .enter()
      .append('path')
      .attr('class', 'polygon')
      .attr('fill-opacity', 0.15)
      .attr('stroke-width', 2)
      .style('cursor', 'pointer');

    if (isFirstRender) {
      polygonsEnter
        .attr('d', collapsedPath)
        .attr('fill', (d) => d.color)
        .attr('stroke', (d) => d.color)
        .attr('stroke-opacity', 1)
        .transition()
        .duration(800)
        .delay((_, i) => 600 + i * 200)
        .ease(d3.easeBackOut.overshoot(1.2))
        .attr('d', (d) => d.path);
    } else {
      polygonsEnter
        .attr('d', (d) => d.path)
        .attr('fill', (d) => d.color)
        .attr('stroke', (d) => d.color)
        .attr('stroke-opacity', 1);
    }

    // Update existing polygons (data change morph)
    polygons.merge(polygonsEnter)
      .interrupt()
      .attr('fill-opacity', 0.15)
      .attr('stroke-opacity', 1)
      .attr('fill', (d) => d.color)
      .attr('stroke', (d) => d.color)
      .transition()
      .duration(isFirstRender ? 0 : 600)
      .ease(d3.easeCubicInOut)
      .attr('d', (d) => d.path);

    // Polygon hover event handlers
    polygonsGroup.selectAll<SVGPathElement, typeof polygonData[0]>('.polygon')
      .on('mouseenter', function (_, d) {
        const idx = d.index;
        polygonsGroup.selectAll<SVGPathElement, typeof polygonData[0]>('.polygon')
          .transition().duration(200)
          .attr('fill-opacity', (p) => (p.index === idx ? 0.3 : 0.05))
          .attr('stroke-opacity', (p) => (p.index === idx ? 1 : 0.3));
      })
      .on('mouseleave', function () {
        polygonsGroup.selectAll<SVGPathElement, typeof polygonData[0]>('.polygon')
          .transition().duration(200)
          .attr('fill-opacity', 0.15)
          .attr('stroke-opacity', 1);
      });

    // ------- Vertex dots -------
    // Flatten vertex data: one entry per (dataset, dimension) pair
    const vertexData = coloredDatasets.flatMap((ds, dsIdx) =>
      dimensions.map((dim, dimIdx) => {
        const angle = dimensionAngle(dimIdx, total);
        const v = orderedValues[dsIdx][dimIdx];
        const pos = polarToCartesian(cx, cy, radius, v, angle);
        return {
          key: `${dsIdx}-${dimIdx}`,
          dsIdx,
          dimIdx,
          dimKey: dim.key,
          cx: pos.x,
          cy: pos.y,
          color: ds.color || DEFAULT_COLORS[dsIdx % DEFAULT_COLORS.length],
          value: v,
        };
      })
    );

    const vertices = verticesGroup
      .selectAll<SVGCircleElement, typeof vertexData[0]>('.vertex')
      .data(vertexData, (d) => d.key);

    vertices.exit().remove();

    const verticesEnter = vertices
      .enter()
      .append('circle')
      .attr('class', 'vertex')
      .attr('fill', (d) => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer');

    if (isFirstRender) {
      verticesEnter
        .attr('cx', (d) => d.cx)
        .attr('cy', (d) => d.cy)
        .attr('r', 0)
        .transition()
        .duration(300)
        .delay((d) => 1000 + d.dsIdx * 200 + d.dimIdx * 40)
        .ease(d3.easeBackOut)
        .attr('r', 4);
    } else {
      verticesEnter.attr('r', 4);
    }

    // Update existing vertices (animate positions on data change)
    vertices.merge(verticesEnter)
      .interrupt()
      .attr('fill', (d) => d.color)
      .transition()
      .duration(isFirstRender ? 0 : 600)
      .ease(d3.easeCubicInOut)
      .attr('cx', (d) => d.cx)
      .attr('cy', (d) => d.cy);

    // Vertex hover event handlers
    verticesGroup.selectAll<SVGCircleElement, typeof vertexData[0]>('.vertex')
      .on('mouseenter', function (event, d) {
        // Scale up the hovered vertex
        d3.select(this)
          .interrupt()
          .transition().duration(150)
          .attr('r', 6);

        // Build tooltip content
        const dim = dimensions[d.dimIdx];
        const lines = coloredDatasets.map((ds, dsIdx) => {
          const val = orderedValues[dsIdx][d.dimIdx];
          return `<div style="display:flex;justify-content:space-between;gap:16px;align-items:center">
            <span style="display:flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${ds.color}"></span>
              <span style="opacity:0.8">${ds.label}</span>
            </span>
            <span style="font-weight:500">${val.toFixed(0)}</span>
          </div>`;
        }).join('');

        const descHtml = dim.description
          ? `<div style="font-size:11px;opacity:0.7;margin-bottom:6px">${dim.description}</div>`
          : '';

        const html = `<div style="min-width:160px">
          <div style="font-weight:600;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:4px;margin-bottom:6px">${dim.label}</div>
          ${descHtml}
          <div style="font-size:12px;display:flex;flex-direction:column;gap:2px">${lines}</div>
        </div>`;

        showTooltipRef.current(
          (event as MouseEvent).clientX,
          (event as MouseEvent).clientY,
          <div dangerouslySetInnerHTML={{ __html: html }} />
        );
      })
      .on('mousemove', function (event) {
        moveTooltipRef.current(
          (event as MouseEvent).clientX,
          (event as MouseEvent).clientY
        );
      })
      .on('mouseleave', function () {
        d3.select(this)
          .interrupt()
          .transition().duration(150)
          .attr('r', 4);
        hideTooltipRef.current();
      });

    // ------- Inline value labels -------
    if (showValues) {
      const valueLabelData = coloredDatasets.flatMap((ds, dsIdx) =>
        dimensions.map((_, dimIdx) => {
          const angle = dimensionAngle(dimIdx, total);
          const v = orderedValues[dsIdx][dimIdx];
          const pos = polarToCartesian(cx, cy, radius, v, angle);
          return {
            key: `${dsIdx}-${dimIdx}`,
            x: pos.x,
            y: pos.y - 8,
            color: ds.color || DEFAULT_COLORS[dsIdx % DEFAULT_COLORS.length],
            text: v.toFixed(0),
          };
        })
      );

      const valueLabels = valueLabelsGroup
        .selectAll<SVGTextElement, typeof valueLabelData[0]>('.value-label')
        .data(valueLabelData, (d) => d.key);

      valueLabels.exit().remove();

      const valueLabelsEnter = valueLabels
        .enter()
        .append('text')
        .attr('class', 'value-label')
        .attr('text-anchor', 'middle')
        .attr('font-size', 10)
        .attr('font-weight', 600);

      if (isFirstRender) {
        valueLabelsEnter
          .attr('x', (d) => d.x)
          .attr('y', (d) => d.y)
          .attr('fill', (d) => d.color)
          .attr('opacity', 0)
          .text((d) => d.text)
          .transition()
          .duration(300)
          .delay(1200)
          .attr('opacity', 1);
      } else {
        valueLabelsEnter
          .attr('fill', (d) => d.color)
          .attr('opacity', 1)
          .text((d) => d.text);
      }

      valueLabels.merge(valueLabelsEnter)
        .interrupt()
        .attr('opacity', 1)
        .attr('fill', (d) => d.color)
        .text((d) => d.text)
        .transition()
        .duration(isFirstRender ? 0 : 600)
        .ease(d3.easeCubicInOut)
        .attr('x', (d) => d.x)
        .attr('y', (d) => d.y);
    } else {
      valueLabelsGroup.selectAll('.value-label').remove();
    }

    // Mark initial render complete
    if (isFirstRender) {
      isInitialRender.current = false;
    }
  }, [
    effectiveWidth,
    chartAreaHeight,
    cx,
    cy,
    radius,
    dimensions,
    datasets,
    coloredDatasets,
    orderedValues,
    polygonPaths,
    showLabels,
    showValues,
  ]);

  // ── Race mode rendering ──
  useEffect(() => {
    if (!isRaceMode || !raceFrames || raceFrames.length === 0) return;
    if (!svgRef.current || !dimensions || dimensions.length < 3) return;
    if (!effectiveWidth || !chartAreaHeight) return;

    const svg = d3.select(svgRef.current);
    const total = dimensions.length;

    function renderFrame(frameIdx: number) {
      const frame = raceFrames![frameIdx];
      if (!frame) return;

      const transitionDuration = raceSpeed * 0.8;

      // For each dataset in the frame, compute polygon path and vertex positions
      const framePolygonData = frame.datasets.map((ds, i) => {
        const vals = dimensions.map(dim => {
          const v = ds.values[dim.key];
          return typeof v === 'number' ? Math.max(0, Math.min(100, v)) : 0;
        });
        const path = buildPolygonPath(cx, cy, radius, vals, total);
        return {
          index: i,
          label: ds.label,
          color: ds.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
          path,
          values: vals,
        };
      });

      const polygonsGroup = svg.select<SVGGElement>('.polygons-group');
      const verticesGroup = svg.select<SVGGElement>('.vertices-group');

      // Update polygons
      const polygons = polygonsGroup
        .selectAll<SVGPathElement, typeof framePolygonData[0]>('.polygon')
        .data(framePolygonData, d => String(d.index));

      // Enter new polygons
      const collapsedPath = buildPolygonPath(cx, cy, radius, new Array(total).fill(0), total);
      polygons.enter()
        .append('path')
        .attr('class', 'polygon')
        .attr('d', collapsedPath)
        .attr('fill', d => d.color)
        .attr('stroke', d => d.color)
        .attr('fill-opacity', 0.15)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 1)
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeCubicInOut)
        .attr('d', d => d.path);

      // Update existing polygons
      polygons
        .interrupt()
        .attr('fill', d => d.color)
        .attr('stroke', d => d.color)
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeCubicInOut)
        .attr('d', d => d.path);

      // Exit old polygons
      polygons.exit()
        .transition()
        .duration(transitionDuration * 0.5)
        .attr('d', collapsedPath)
        .attr('opacity', 0)
        .remove();

      // Update vertex dots
      const vertexData = framePolygonData.flatMap((ds, dsIdx) =>
        dimensions.map((dim, dimIdx) => {
          const angle = dimensionAngle(dimIdx, total);
          const v = ds.values[dimIdx];
          const pos = polarToCartesian(cx, cy, radius, v, angle);
          return {
            key: `${dsIdx}-${dimIdx}`,
            cx: pos.x,
            cy: pos.y,
            color: ds.color,
          };
        })
      );

      const vertices = verticesGroup
        .selectAll<SVGCircleElement, typeof vertexData[0]>('.vertex')
        .data(vertexData, d => d.key);

      vertices.enter()
        .append('circle')
        .attr('class', 'vertex')
        .attr('cx', d => d.cx)
        .attr('cy', d => d.cy)
        .attr('r', 0)
        .attr('fill', d => d.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .transition()
        .duration(transitionDuration * 0.5)
        .attr('r', 4);

      vertices
        .interrupt()
        .attr('fill', d => d.color)
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeCubicInOut)
        .attr('cx', d => d.cx)
        .attr('cy', d => d.cy);

      vertices.exit()
        .transition()
        .duration(transitionDuration * 0.5)
        .attr('r', 0)
        .remove();

      setCurrentDate(frame.date);
    }

    renderRaceFrameRef.current = renderFrame;
    renderFrame(raceFrameRef.current);
  }, [isRaceMode, raceFrames, dimensions, cx, cy, radius, chartAreaHeight, effectiveWidth, raceSpeed]);

  // ── Race playback loop ──
  useEffect(() => {
    if (!isPlaying || !isRaceMode || !raceFrames?.length) return;
    raceTimerRef.current = setInterval(() => {
      raceFrameRef.current = (raceFrameRef.current + 1) % raceFrames.length;
      setCurrentFrame(raceFrameRef.current);
      renderRaceFrameRef.current?.(raceFrameRef.current);
      onFrameChangeRef.current?.(raceFrameRef.current, raceFrames[raceFrameRef.current].date);
    }, raceSpeed);
    return () => { if (raceTimerRef.current) clearInterval(raceTimerRef.current); };
  }, [isPlaying, raceSpeed, raceFrames, isRaceMode]);

  const togglePlay = useCallback(() => setIsPlaying(p => !p), []);
  const seekToFrame = useCallback((idx: number) => {
    raceFrameRef.current = idx;
    setCurrentFrame(idx);
    renderRaceFrameRef.current?.(idx);
    if (raceFrames) onFrameChangeRef.current?.(idx, raceFrames[idx].date);
  }, [raceFrames]);

  // ------- Legend highlight (dispatches to D3) -------
  const highlightDataset = useCallback((idx: number | null) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('.polygon')
      .transition().duration(200)
      .attr('fill-opacity', (_, i) => idx === null ? 0.15 : (i === idx ? 0.3 : 0.05))
      .attr('stroke-opacity', (_, i) => idx === null ? 1 : (i === idx ? 1 : 0.3));
  }, []);

  // ----- Render -----

  if (!dimensions || dimensions.length < 3) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-container rounded-2xl h-full ${className}`}
      >
        <p className="text-on-surface-variant">
          Radar chart requires at least 3 dimensions
        </p>
      </div>
    );
  }

  if (!datasets || datasets.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-container rounded-2xl h-full ${className}`}
      >
        <p className="text-on-surface-variant">No data available</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative h-full ${className}`}>
      <svg
        ref={svgRef}
        width={effectiveWidth}
        height={effectiveHeight}
        className="overflow-visible"
      />

      {/* Race mode playback controls */}
      {isRaceMode && raceFrames && (
        <PlaybackControls
          frameCount={raceFrames.length}
          currentFrame={currentFrame}
          currentDate={currentDate}
          isPlaying={isPlaying}
          speed={raceSpeed}
          onTogglePlay={togglePlay}
          onSeek={seekToFrame}
          onSpeedChange={setRaceSpeed}
        />
      )}

      {/* ---- Legend (React-rendered) ---- */}
      <div
        className="flex items-center justify-center gap-6 flex-wrap"
        style={{ height: legendHeight }}
      >
        {coloredDatasets.map((ds, idx) => (
          <div
            key={ds.label}
            className="flex items-center gap-2 text-sm cursor-default"
            onMouseEnter={() => highlightDataset(idx)}
            onMouseLeave={() => highlightDataset(null)}
          >
            <span
              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: ds.color }}
            />
            <span className="text-on-surface-variant font-medium">{ds.label}</span>
          </div>
        ))}
      </div>

      <D3Tooltip {...tooltip} />
    </div>
  );
};

export default RadarChart;
