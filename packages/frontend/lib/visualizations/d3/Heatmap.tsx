'use client';

import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useD3, useD3Tooltip, D3Tooltip, useResponsiveD3 } from './hooks/useD3';
import {
  CHART_COLORS,
  createValueScale,
  FormatType,
  getFormatter,
} from './utils/scales';

interface HeatmapCell {
  x: string;
  y: string;
  value: number;
  normalizedValue?: number; // 0-1 normalized value for coloring
}

interface HeatmapProps {
  data: HeatmapCell[];
  xLabels?: string[];
  yLabels?: string[];
  xLabel?: string;
  yLabel?: string;
  valueFormat?: FormatType;
  colorScale?: 'sequential' | 'diverging';
  colorScheme?: 'purple' | 'bluePurple' | 'warm' | 'cool' | 'redBlue' | 'redGreen';
  showValues?: boolean;
  normalizePerColumn?: boolean; // Normalize each column independently for better comparison
  height?: number;
  className?: string;
  onCellClick?: (cell: HeatmapCell) => void;
}

export const Heatmap: React.FC<HeatmapProps> = ({
  data,
  xLabels: providedXLabels,
  yLabels: providedYLabels,
  xLabel,
  yLabel,
  valueFormat = 'number',
  colorScale = 'sequential',
  colorScheme = 'purple',
  showValues = true,
  normalizePerColumn = true,
  height = 400,
  className = '',
  onCellClick,
}) => {
  const { containerRef, width } = useResponsiveD3<HTMLDivElement>(16 / 10, height);
  const { tooltip, showTooltip, hideTooltip, moveTooltip } = useD3Tooltip();

  // Extract unique labels
  const xLabels = useMemo(
    () => providedXLabels || [...new Set(data.map((d) => d.x))],
    [data, providedXLabels]
  );

  const yLabels = useMemo(
    () => providedYLabels || [...new Set(data.map((d) => d.y))],
    [data, providedYLabels]
  );

  // Normalize data per column when metrics have different scales
  const normalizedData = useMemo(() => {
    if (!normalizePerColumn) return data;

    // Group data by x (metric/column)
    const columnGroups = new Map<string, HeatmapCell[]>();
    data.forEach((cell) => {
      const group = columnGroups.get(cell.x) || [];
      group.push(cell);
      columnGroups.set(cell.x, group);
    });

    // Normalize each column independently
    const result: HeatmapCell[] = [];
    columnGroups.forEach((cells) => {
      const values = cells.map((c) => c.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1; // Avoid division by zero

      cells.forEach((cell) => {
        result.push({
          ...cell,
          normalizedValue: (cell.value - min) / range,
        });
      });
    });

    return result;
  }, [data, normalizePerColumn]);

  // Calculate dimensions
  const margins = useMemo(
    () => ({
      top: 20,
      right: 20,
      bottom: xLabel ? 60 : 40,
      left: yLabel ? 80 : 60,
    }),
    [xLabel, yLabel]
  );

  const chartWidth = (width || 600) - margins.left - margins.right;
  const chartHeight = height - margins.top - margins.bottom;

  const cellWidth = chartWidth / xLabels.length;
  const cellHeight = chartHeight / yLabels.length;

  // Create scales
  const xScale = useMemo(
    () =>
      d3
        .scaleBand()
        .domain(xLabels)
        .range([0, chartWidth])
        .padding(0.05),
    [xLabels, chartWidth]
  );

  const yScale = useMemo(
    () =>
      d3
        .scaleBand()
        .domain(yLabels)
        .range([0, chartHeight])
        .padding(0.05),
    [yLabels, chartHeight]
  );

  // Color scale - uses normalized values (0-1) when normalizePerColumn is true
  const colorFn = useMemo(() => {
    if (normalizePerColumn) {
      // Use 0-1 range for normalized values
      const scale = createValueScale([0, 1], colorScale, colorScheme as any);
      return (value: number, normalizedValue?: number) =>
        scale(normalizedValue ?? value) as string;
    } else {
      const values = data.map((d) => d.value);
      const extent = d3.extent(values) as [number, number];
      const scale = createValueScale(extent, colorScale, colorScheme as any);
      return (value: number) => scale(value) as string;
    }
  }, [data, normalizePerColumn, colorScale, colorScheme]);

  // Create data map for quick lookup (using normalized data)
  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    normalizedData.forEach((d) => {
      map.set(`${d.x}|${d.y}`, d);
    });
    return map;
  }, [normalizedData]);

  // Handle tooltip
  const handleMouseOver = useCallback(
    (event: React.MouseEvent, cell: HeatmapCell) => {
      const formatter = getFormatter(valueFormat);
      const content = (
        <div className="space-y-1">
          <div className="font-medium">
            {cell.x} × {cell.y}
          </div>
          <div className="text-sm">{formatter(cell.value)}</div>
        </div>
      );
      showTooltip(event.clientX, event.clientY, content);
    },
    [showTooltip, valueFormat]
  );

  // Determine if value label should be shown
  const shouldShowValue = cellWidth > 30 && cellHeight > 20;

  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-container rounded-2xl ${className}`}
        style={{ height }}
      >
        <p className="text-on-surface-variant">No data available</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <svg width={width || '100%'} height={height} className="overflow-visible">
        <g transform={`translate(${margins.left},${margins.top})`}>
          {/* Cells */}
          {yLabels.map((y) =>
            xLabels.map((x) => {
              const cell = dataMap.get(`${x}|${y}`);
              if (!cell) return null;

              const xPos = xScale(x) ?? 0;
              const yPos = yScale(y) ?? 0;
              const width = xScale.bandwidth();
              const height = yScale.bandwidth();

              // Determine text color based on background
              const bgColor = colorFn(cell.value, cell.normalizedValue);
              const rgb = d3.rgb(bgColor);
              const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
              const textColor = luminance > 128 ? '#1d1b20' : '#ffffff';

              return (
                <g key={`${x}|${y}`}>
                  <rect
                    x={xPos}
                    y={yPos}
                    width={width}
                    height={height}
                    fill={bgColor}
                    rx={2}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onMouseEnter={(e) => handleMouseOver(e, cell)}
                    onMouseMove={(e) => moveTooltip(e.clientX, e.clientY)}
                    onMouseLeave={hideTooltip}
                    onClick={() => onCellClick?.(cell)}
                  />
                  {showValues && shouldShowValue && (
                    <text
                      x={xPos + width / 2}
                      y={yPos + height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={textColor}
                      fontSize={Math.min(cellWidth, cellHeight) * 0.35}
                      className="pointer-events-none"
                    >
                      {getFormatter(valueFormat)(cell.value)}
                    </text>
                  )}
                </g>
              );
            })
          )}

          {/* X axis */}
          <g transform={`translate(0,${chartHeight})`}>
            {xLabels.map((label) => {
              const xPos = (xScale(label) ?? 0) + xScale.bandwidth() / 2;
              return (
                <text
                  key={label}
                  x={xPos}
                  y={15}
                  textAnchor="middle"
                  fill={CHART_COLORS.onSurfaceVariant}
                  fontSize={Math.min(11, cellWidth * 0.5)}
                  className="select-none"
                >
                  {label.length > 10 ? `${label.slice(0, 10)}...` : label}
                </text>
              );
            })}
            {xLabel && (
              <text
                x={chartWidth / 2}
                y={40}
                textAnchor="middle"
                fill={CHART_COLORS.onSurfaceVariant}
                fontSize={12}
                fontWeight={500}
              >
                {xLabel}
              </text>
            )}
          </g>

          {/* Y axis */}
          <g>
            {yLabels.map((label) => {
              const yPos = (yScale(label) ?? 0) + yScale.bandwidth() / 2;
              return (
                <text
                  key={label}
                  x={-8}
                  y={yPos}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill={CHART_COLORS.onSurfaceVariant}
                  fontSize={Math.min(11, cellHeight * 0.5)}
                  className="select-none"
                >
                  {label.length > 12 ? `${label.slice(0, 12)}...` : label}
                </text>
              );
            })}
            {yLabel && (
              <text
                transform="rotate(-90)"
                x={-chartHeight / 2}
                y={-55}
                textAnchor="middle"
                fill={CHART_COLORS.onSurfaceVariant}
                fontSize={12}
                fontWeight={500}
              >
                {yLabel}
              </text>
            )}
          </g>
        </g>

        {/* Color legend */}
        <g transform={`translate(${(width || 600) - margins.right - 100},${margins.top})`}>
          <defs>
            <linearGradient id="heatmap-legend-gradient" x1="0" x2="0" y1="1" y2="0">
              {[0, 0.25, 0.5, 0.75, 1].map((stop) => {
                const values = data.map((d) => d.value);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const value = min + (max - min) * stop;
                return (
                  <stop
                    key={stop}
                    offset={`${stop * 100}%`}
                    stopColor={colorFn(value)}
                  />
                );
              })}
            </linearGradient>
          </defs>
          <rect
            x={0}
            y={0}
            width={12}
            height={80}
            fill="url(#heatmap-legend-gradient)"
            rx={2}
          />
          <text
            x={16}
            y={8}
            fontSize={9}
            fill={CHART_COLORS.onSurfaceVariant}
          >
            {getFormatter(valueFormat)(Math.max(...data.map((d) => d.value)))}
          </text>
          <text
            x={16}
            y={80}
            fontSize={9}
            fill={CHART_COLORS.onSurfaceVariant}
          >
            {getFormatter(valueFormat)(Math.min(...data.map((d) => d.value)))}
          </text>
        </g>
      </svg>

      <D3Tooltip {...tooltip} />
    </div>
  );
};

export default Heatmap;
