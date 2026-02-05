'use client';

import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useD3Tooltip, D3Tooltip, useResponsiveD3 } from './hooks/useD3';
import { CHART_COLORS, getFormatter } from './utils/scales';

interface MetricData {
  id: string;
  label: string;
  values: number[];
}

interface CorrelationMatrixProps {
  data: MetricData[];
  height?: number;
  showValues?: boolean;
  colorScale?: 'diverging' | 'absolute';
  className?: string;
  onCellClick?: (metric1: string, metric2: string, correlation: number) => void;
}

// Calculate Pearson correlation coefficient
function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;

  const meanX = d3.mean(x.slice(0, n)) ?? 0;
  const meanY = d3.mean(y.slice(0, n)) ?? 0;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({
  data,
  height: providedHeight,
  showValues = true,
  colorScale = 'diverging',
  className = '',
  onCellClick,
}) => {
  const { containerRef, width } = useResponsiveD3<HTMLDivElement>(1, 400);
  const { tooltip, showTooltip, hideTooltip, moveTooltip } = useD3Tooltip();

  // Calculate correlations
  const correlations = useMemo(() => {
    const matrix: { x: string; y: string; value: number; xLabel: string; yLabel: string }[] = [];

    data.forEach((metricX) => {
      data.forEach((metricY) => {
        const correlation = calculateCorrelation(metricX.values, metricY.values);
        matrix.push({
          x: metricX.id,
          y: metricY.id,
          xLabel: metricX.label,
          yLabel: metricY.label,
          value: correlation,
        });
      });
    });

    return matrix;
  }, [data]);

  // Dimensions
  const labels = data.map((d) => d.id);
  const labelNames = data.map((d) => d.label);
  const n = labels.length;

  const margins = useMemo(
    () => ({
      top: 10,
      right: 10,
      bottom: Math.max(60, n * 15),
      left: Math.max(80, n * 15),
    }),
    [n]
  );

  const height = providedHeight || Math.max(400, n * 40 + margins.top + margins.bottom);
  const chartSize = Math.min(
    (width || 600) - margins.left - margins.right,
    height - margins.top - margins.bottom
  );
  const cellSize = chartSize / n;

  // Scales
  const scale = useMemo(
    () =>
      d3
        .scaleBand()
        .domain(labels)
        .range([0, chartSize])
        .padding(0.05),
    [labels, chartSize]
  );

  // Color scale
  const getColor = useCallback(
    (value: number) => {
      if (colorScale === 'absolute') {
        // Blue scale for absolute correlation
        return d3.interpolateBlues(Math.abs(value));
      }
      // Diverging scale: red (negative) - white - blue (positive)
      return d3.interpolateRdBu(0.5 + value / 2);
    },
    [colorScale]
  );

  // Handle tooltip
  const handleMouseOver = useCallback(
    (event: React.MouseEvent, cell: typeof correlations[0]) => {
      const content = (
        <div className="space-y-1">
          <div className="font-medium">
            {cell.xLabel} vs {cell.yLabel}
          </div>
          <div className="text-sm">
            Correlation: <span className="font-medium">{cell.value.toFixed(3)}</span>
          </div>
          <div className="text-xs opacity-75">
            {Math.abs(cell.value) >= 0.7
              ? 'Strong'
              : Math.abs(cell.value) >= 0.4
              ? 'Moderate'
              : Math.abs(cell.value) >= 0.2
              ? 'Weak'
              : 'Very weak'}
            {cell.value >= 0 ? ' positive' : ' negative'}
            {cell.x === cell.y ? ' (self)' : ''}
          </div>
        </div>
      );
      showTooltip(event.clientX, event.clientY, content);
    },
    [showTooltip]
  );

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
          {correlations.map((cell) => {
            const xPos = scale(cell.x) ?? 0;
            const yPos = scale(cell.y) ?? 0;
            const bandWidth = scale.bandwidth();

            // Determine text color based on background
            const bgColor = getColor(cell.value);
            const rgb = d3.rgb(bgColor);
            const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
            const textColor = luminance > 128 ? '#1d1b20' : '#ffffff';

            return (
              <g key={`${cell.x}|${cell.y}`}>
                <rect
                  x={xPos}
                  y={yPos}
                  width={bandWidth}
                  height={bandWidth}
                  fill={getColor(cell.value)}
                  stroke={CHART_COLORS.surface}
                  strokeWidth={1}
                  rx={2}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={(e) => handleMouseOver(e, cell)}
                  onMouseMove={(e) => moveTooltip(e.clientX, e.clientY)}
                  onMouseLeave={hideTooltip}
                  onClick={() => onCellClick?.(cell.x, cell.y, cell.value)}
                />
                {showValues && cellSize > 25 && (
                  <text
                    x={xPos + bandWidth / 2}
                    y={yPos + bandWidth / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={textColor}
                    fontSize={Math.min(12, cellSize * 0.3)}
                    fontWeight={cell.x === cell.y ? '600' : '400'}
                    className="pointer-events-none select-none"
                  >
                    {cell.value.toFixed(2)}
                  </text>
                )}
              </g>
            );
          })}

          {/* X axis labels (bottom) */}
          {labels.map((label, i) => (
            <text
              key={`x-${label}`}
              x={(scale(label) ?? 0) + scale.bandwidth() / 2}
              y={chartSize + 10}
              textAnchor="start"
              transform={`rotate(45,${(scale(label) ?? 0) + scale.bandwidth() / 2},${chartSize + 10})`}
              fill={CHART_COLORS.onSurfaceVariant}
              fontSize={Math.min(11, cellSize * 0.4)}
              className="select-none"
            >
              {labelNames[i].length > 15
                ? `${labelNames[i].slice(0, 15)}...`
                : labelNames[i]}
            </text>
          ))}

          {/* Y axis labels (left) */}
          {labels.map((label, i) => (
            <text
              key={`y-${label}`}
              x={-8}
              y={(scale(label) ?? 0) + scale.bandwidth() / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fill={CHART_COLORS.onSurfaceVariant}
              fontSize={Math.min(11, cellSize * 0.4)}
              className="select-none"
            >
              {labelNames[i].length > 15
                ? `${labelNames[i].slice(0, 15)}...`
                : labelNames[i]}
            </text>
          ))}
        </g>

        {/* Color legend */}
        <g
          transform={`translate(${margins.left + chartSize + 20},${margins.top})`}
        >
          <text
            x={0}
            y={-5}
            fontSize={10}
            fontWeight={500}
            fill={CHART_COLORS.onSurfaceVariant}
          >
            Correlation
          </text>
          <defs>
            <linearGradient
              id="correlation-legend-gradient"
              x1="0"
              x2="0"
              y1="1"
              y2="0"
            >
              {colorScale === 'diverging' ? (
                <>
                  <stop offset="0%" stopColor={d3.interpolateRdBu(0)} />
                  <stop offset="50%" stopColor={d3.interpolateRdBu(0.5)} />
                  <stop offset="100%" stopColor={d3.interpolateRdBu(1)} />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor={d3.interpolateBlues(0)} />
                  <stop offset="100%" stopColor={d3.interpolateBlues(1)} />
                </>
              )}
            </linearGradient>
          </defs>
          <rect
            x={0}
            y={5}
            width={12}
            height={Math.min(100, chartSize * 0.5)}
            fill="url(#correlation-legend-gradient)"
            rx={2}
          />
          <text
            x={16}
            y={12}
            fontSize={9}
            fill={CHART_COLORS.onSurfaceVariant}
          >
            {colorScale === 'diverging' ? '+1.0' : '1.0'}
          </text>
          {colorScale === 'diverging' && (
            <text
              x={16}
              y={Math.min(100, chartSize * 0.5) / 2 + 5}
              fontSize={9}
              fill={CHART_COLORS.onSurfaceVariant}
            >
              0
            </text>
          )}
          <text
            x={16}
            y={Math.min(100, chartSize * 0.5) + 5}
            fontSize={9}
            fill={CHART_COLORS.onSurfaceVariant}
          >
            {colorScale === 'diverging' ? '-1.0' : '0'}
          </text>
        </g>
      </svg>

      <D3Tooltip {...tooltip} />
    </div>
  );
};

export default CorrelationMatrix;
