'use client';

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
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

interface ScatterPlotProps {
  data: ScatterDataPoint[];
  xLabel?: string;
  yLabel?: string;
  xFormat?: FormatType;
  yFormat?: FormatType;
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
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({
  data,
  xLabel,
  yLabel,
  xFormat = 'number',
  yFormat = 'number',
  showRegression = false,
  showQuadrants = false,
  quadrantLabels,
  colorByCategory = true,
  sizeByValue = true,
  height = 400,
  className = '',
  onPointClick,
}) => {
  const { containerRef, width } = useResponsiveD3<HTMLDivElement>(16 / 10, height);
  const { tooltip, showTooltip, hideTooltip, moveTooltip } = useD3Tooltip();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  // Margins
  const margins = useMemo(() => ({
    left: 70,
    right: 30,
    top: 20,
    bottom: 50,
  }), []);

  const chartWidth = (width || 600) - margins.left - margins.right;
  const chartHeight = height - margins.top - margins.bottom;

  // Calculate base scales
  const baseScales = useMemo(() => {
    if (data.length === 0) return null;

    const xExtent = d3.extent(data, (d) => d.x) as [number, number];
    const yExtent = d3.extent(data, (d) => d.y) as [number, number];

    // Add padding to extents
    const xPadding = (xExtent[1] - xExtent[0]) * 0.05;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.05;

    const xScale = createLinearScale(
      [xExtent[0] - xPadding, xExtent[1] + xPadding],
      [0, chartWidth]
    );
    const yScale = createLinearScale(
      [yExtent[0] - yPadding, yExtent[1] + yPadding],
      [chartHeight, 0]
    );

    // Size scale
    const sizeExtent: [number, number] = sizeByValue
      ? (d3.extent(data, (d) => d.size ?? 1) as [number, number])
      : [1, 1];
    const sizeScale = createSizeScale(sizeExtent, [5, 20]);

    // Color scale
    const categories = [...new Set(data.map((d) => d.category || 'default'))];
    const colorScale = categoricalScale(categories);

    return { xScale, yScale, sizeScale, colorScale, xExtent, yExtent };
  }, [data, chartWidth, chartHeight, sizeByValue]);

  // Apply zoom transform to scales
  const scales = useMemo(() => {
    if (!baseScales) return null;

    const newXScale = zoomTransform.rescaleX(baseScales.xScale as d3.ScaleLinear<number, number>);
    const newYScale = zoomTransform.rescaleY(baseScales.yScale as d3.ScaleLinear<number, number>);

    return {
      ...baseScales,
      xScale: newXScale,
      yScale: newYScale,
    };
  }, [baseScales, zoomTransform]);

  // Calculate regression line
  const regressionLine = useMemo(() => {
    if (!showRegression || data.length < 2 || !scales) return null;

    const n = data.length;
    const sumX = d3.sum(data, (d) => d.x);
    const sumY = d3.sum(data, (d) => d.y);
    const sumXY = d3.sum(data, (d) => d.x * d.y);
    const sumX2 = d3.sum(data, (d) => d.x * d.x);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Get visible x range from current zoom
    const xDomain = scales.xScale.domain();
    const x1 = xDomain[0];
    const x2 = xDomain[1];
    const y1 = slope * x1 + intercept;
    const y2 = slope * x2 + intercept;

    return { x1, y1, x2, y2, slope, intercept };
  }, [data, showRegression, scales]);

  // Setup zoom behavior
  useEffect(() => {
    if (!svgRef.current || !baseScales) return;

    const svg = d3.select(svgRef.current);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .extent([[0, 0], [chartWidth, chartHeight]])
      .translateExtent([[-chartWidth, -chartHeight], [chartWidth * 2, chartHeight * 2]])
      .on('zoom', (event) => {
        setZoomTransform(event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Add zoom reset on double-click
    svg.on('dblclick.zoom', () => {
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    });

    return () => {
      svg.on('.zoom', null);
    };
  }, [baseScales, chartWidth, chartHeight]);

  // Handle point interactions
  const handleMouseOver = useCallback(
    (event: React.MouseEvent, point: ScatterDataPoint) => {
      const xFormatter = getFormatter(xFormat);
      const yFormatter = getFormatter(yFormat);

      const content = point.tooltip || (
        <div className="min-w-[180px]">
          <div className="font-semibold text-sm border-b border-white/20 pb-1 mb-1.5">
            {point.label}
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between gap-4">
              <span className="opacity-70">{xLabel || 'X'}:</span>
              <span className="font-medium">{xFormatter(point.x)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="opacity-70">{yLabel || 'Y'}:</span>
              <span className="font-medium">{yFormatter(point.y)}</span>
            </div>
            {point.size !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="opacity-70">Size:</span>
                <span className="font-medium">{point.size.toLocaleString()}</span>
              </div>
            )}
            {point.category && (
              <div className="flex justify-between gap-4">
                <span className="opacity-70">Category:</span>
                <span className="font-medium">{point.category}</span>
              </div>
            )}
          </div>
          {onPointClick && (
            <div className="text-[10px] opacity-60 mt-2 pt-1 border-t border-white/20">
              Click for details
            </div>
          )}
        </div>
      );
      showTooltip(event.clientX, event.clientY, content);
    },
    [showTooltip, xLabel, yLabel, xFormat, yFormat, onPointClick]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      moveTooltip(event.clientX, event.clientY);
    },
    [moveTooltip]
  );

  // Formatters for axes
  const xFormatter = getFormatter(xFormat);
  const yFormatter = getFormatter(yFormat);

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-surface-container rounded-2xl ${className}`} style={{ height }}>
        <p className="text-on-surface-variant">No data available</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <svg
        ref={svgRef}
        width={width || '100%'}
        height={height}
        className="overflow-visible"
        style={{ cursor: 'grab' }}
      >
        <defs>
          <clipPath id="scatter-clip">
            <rect x={0} y={0} width={chartWidth} height={chartHeight} />
          </clipPath>
        </defs>

        <g transform={`translate(${margins.left},${margins.top})`}>
          {/* Background for zoom area */}
          <rect
            x={0}
            y={0}
            width={chartWidth}
            height={chartHeight}
            fill="transparent"
          />

          {scales && (
            <>
              {/* Grid lines */}
              <g className="grid-lines" opacity={0.3}>
                {scales.xScale.ticks(6).map((tick) => (
                  <line
                    key={`x-grid-${tick}`}
                    x1={scales.xScale(tick)}
                    x2={scales.xScale(tick)}
                    y1={0}
                    y2={chartHeight}
                    stroke={CHART_COLORS.outlineVariant}
                    strokeDasharray="2,2"
                  />
                ))}
                {scales.yScale.ticks(6).map((tick) => (
                  <line
                    key={`y-grid-${tick}`}
                    x1={0}
                    x2={chartWidth}
                    y1={scales.yScale(tick)}
                    y2={scales.yScale(tick)}
                    stroke={CHART_COLORS.outlineVariant}
                    strokeDasharray="2,2"
                  />
                ))}
              </g>

              {/* Quadrant lines */}
              {showQuadrants && baseScales && (
                <g className="quadrants" opacity={0.5}>
                  <line
                    x1={scales.xScale((baseScales.xExtent[0] + baseScales.xExtent[1]) / 2)}
                    x2={scales.xScale((baseScales.xExtent[0] + baseScales.xExtent[1]) / 2)}
                    y1={0}
                    y2={chartHeight}
                    stroke={CHART_COLORS.outlineVariant}
                    strokeDasharray="4,4"
                  />
                  <line
                    x1={0}
                    x2={chartWidth}
                    y1={scales.yScale((baseScales.yExtent[0] + baseScales.yExtent[1]) / 2)}
                    y2={scales.yScale((baseScales.yExtent[0] + baseScales.yExtent[1]) / 2)}
                    stroke={CHART_COLORS.outlineVariant}
                    strokeDasharray="4,4"
                  />
                </g>
              )}

              {/* Regression line */}
              {regressionLine && (
                <line
                  x1={scales.xScale(regressionLine.x1)}
                  x2={scales.xScale(regressionLine.x2)}
                  y1={scales.yScale(regressionLine.y1)}
                  y2={scales.yScale(regressionLine.y2)}
                  stroke={CHART_COLORS.baseline}
                  strokeWidth={2}
                  strokeDasharray="6,4"
                  opacity={0.7}
                  clipPath="url(#scatter-clip)"
                />
              )}

              {/* Data points */}
              <g clipPath="url(#scatter-clip)">
                {data.map((point) => {
                  const cx = scales.xScale(point.x);
                  const cy = scales.yScale(point.y);
                  const r = sizeByValue ? scales.sizeScale(point.size ?? 1) : 8;

                  // Skip points outside visible area (with padding for size)
                  if (cx < -r || cx > chartWidth + r || cy < -r || cy > chartHeight + r) {
                    return null;
                  }

                  return (
                    <circle
                      key={point.id}
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={colorByCategory ? scales.colorScale(point.category || 'default') : CHART_COLORS.primary}
                      fillOpacity={0.7}
                      stroke="#fff"
                      strokeWidth={1.5}
                      style={{
                        cursor: onPointClick ? 'pointer' : 'default',
                        transition: 'fill-opacity 0.15s, stroke-width 0.15s, r 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.setAttribute('fill-opacity', '1');
                        e.currentTarget.setAttribute('stroke-width', '2.5');
                        e.currentTarget.setAttribute('r', String(r * 1.2));
                        handleMouseOver(e, point);
                      }}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={(e) => {
                        e.currentTarget.setAttribute('fill-opacity', '0.7');
                        e.currentTarget.setAttribute('stroke-width', '1.5');
                        e.currentTarget.setAttribute('r', String(r));
                        hideTooltip();
                      }}
                      onClick={() => onPointClick?.(point)}
                    />
                  );
                })}
              </g>

              {/* X Axis */}
              <g transform={`translate(0,${chartHeight})`}>
                <line x1={0} x2={chartWidth} y1={0} y2={0} stroke={CHART_COLORS.outline} />
                {scales.xScale.ticks(6).map((tick) => (
                  <g key={`x-${tick}`} transform={`translate(${scales.xScale(tick)},0)`}>
                    <line y2={6} stroke={CHART_COLORS.outline} />
                    <text
                      y={20}
                      textAnchor="middle"
                      fill={CHART_COLORS.onSurfaceVariant}
                      fontSize={11}
                    >
                      {xFormatter(tick)}
                    </text>
                  </g>
                ))}
                {xLabel && (
                  <text
                    x={chartWidth}
                    y={40}
                    textAnchor="end"
                    fill={CHART_COLORS.onSurfaceVariant}
                    fontSize={12}
                    fontWeight={500}
                  >
                    {xLabel}
                  </text>
                )}
              </g>

              {/* Y Axis */}
              <g>
                <line x1={0} x2={0} y1={0} y2={chartHeight} stroke={CHART_COLORS.outline} />
                {scales.yScale.ticks(6).map((tick) => (
                  <g key={`y-${tick}`} transform={`translate(0,${scales.yScale(tick)})`}>
                    <line x2={-6} stroke={CHART_COLORS.outline} />
                    <text
                      x={-10}
                      dy="0.32em"
                      textAnchor="end"
                      fill={CHART_COLORS.onSurfaceVariant}
                      fontSize={11}
                    >
                      {yFormatter(tick)}
                    </text>
                  </g>
                ))}
                {yLabel && (
                  <text
                    transform={`translate(-55,${chartHeight / 2}) rotate(-90)`}
                    textAnchor="middle"
                    fill={CHART_COLORS.onSurfaceVariant}
                    fontSize={12}
                    fontWeight={500}
                  >
                    {yLabel}
                  </text>
                )}
              </g>
            </>
          )}
        </g>
      </svg>

      {/* Zoom hint */}
      <div className="absolute bottom-2 right-2 text-[10px] text-on-surface-variant opacity-60 pointer-events-none">
        Scroll to zoom • Drag to pan • Double-click to reset
      </div>

      <D3Tooltip {...tooltip} />
    </div>
  );
};

export default ScatterPlot;
