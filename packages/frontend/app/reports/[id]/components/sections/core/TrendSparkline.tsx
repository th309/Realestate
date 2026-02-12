'use client';

import React from 'react';

export type TrendDirection = 'up' | 'down' | 'stable';

export interface TrendSparklineProps {
  /** Array of numeric data points to plot */
  data: number[];
  /** Direction of the trend */
  trend: TrendDirection;
  /** Percentage change to display */
  changePct: number;
  /** Width of the sparkline SVG (default: 80) */
  width?: number;
  /** Height of the sparkline SVG (default: 24) */
  height?: number;
  /** Optional className for the container */
  className?: string;
}

/**
 * TrendSparkline - A mini sparkline chart for trend visualization
 *
 * Displays a simple SVG line chart with an accompanying trend indicator
 * and percentage change. Uses report-theme.css color variables.
 */
export function TrendSparkline({
  data,
  trend,
  changePct,
  width = 80,
  height = 24,
  className = '',
}: TrendSparklineProps): React.ReactElement {
  // Guard against empty data
  if (!data || data.length === 0) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div
          style={{
            width,
            height,
            backgroundColor: 'var(--report-cream-dark)',
            borderRadius: 'var(--report-radius-sm)',
          }}
        />
        <span
          style={{
            color: 'var(--report-stone-light)',
            fontSize: '0.75rem',
          }}
        >
          --
        </span>
      </div>
    );
  }

  // Calculate color based on trend direction
  const getTrendColor = (trendDir: TrendDirection): string => {
    switch (trendDir) {
      case 'up':
        return 'var(--report-success)';
      case 'down':
        return 'var(--report-error)';
      case 'stable':
      default:
        return 'var(--report-stone)';
    }
  };

  const trendColor = getTrendColor(trend);

  // Calculate path coordinates
  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const valueRange = maxValue - minValue || 1; // Avoid division by zero

  // Generate SVG path points
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((value - minValue) / valueRange) * chartHeight;
    return { x, y };
  });

  // Create SVG path string
  const pathD = points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    return `${path} L ${point.x} ${point.y}`;
  }, '');

  // Arrow indicators
  const getArrowIndicator = (trendDir: TrendDirection): string => {
    switch (trendDir) {
      case 'up':
        return '\u2191'; // Up arrow
      case 'down':
        return '\u2193'; // Down arrow
      case 'stable':
      default:
        return '\u2192'; // Right arrow
    }
  };

  // Format the percentage
  const formatPercentage = (pct: number): string => {
    const prefix = pct > 0 ? '+' : '';
    return `${prefix}${pct.toFixed(1)}%`;
  };

  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      role="img"
      aria-label={`Trend sparkline showing ${trend} trend with ${formatPercentage(changePct)} change`}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          overflow: 'visible',
        }}
      >
        {/* Sparkline path */}
        <path
          d={pathD}
          fill="none"
          stroke={trendColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End point dot */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={2}
            fill={trendColor}
          />
        )}
      </svg>

      {/* Trend indicator with percentage */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.125rem',
          fontSize: '0.75rem',
          fontWeight: 500,
          color: trendColor,
          fontFamily: 'var(--report-font-body)',
        }}
      >
        <span aria-hidden="true">{getArrowIndicator(trend)}</span>
        <span>{formatPercentage(changePct)}</span>
      </span>
    </div>
  );
}

export default TrendSparkline;
