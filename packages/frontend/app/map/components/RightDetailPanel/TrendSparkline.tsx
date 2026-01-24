'use client';

import { useMemo } from 'react';
import { normalizeSparklineData } from '../../utils/trendUtils';

interface TrendSparklineProps {
  /** Raw data points for the sparkline */
  data: number[];
  /** Width of the sparkline in pixels */
  width?: number;
  /** Height of the sparkline in pixels */
  height?: number;
  /** Color for upward trend */
  upColor?: string;
  /** Color for downward trend */
  downColor?: string;
  /** Color for stable trend */
  stableColor?: string;
  /** Optional class name */
  className?: string;
}

export function TrendSparkline({
  data,
  width = 48,
  height = 16,
  upColor = '#16a34a',
  downColor = '#dc2626',
  stableColor = '#6b7280',
  className = '',
}: TrendSparklineProps) {
  const { path, color } = useMemo(() => {
    if (data.length < 2) {
      return { path: '', color: stableColor };
    }

    const normalized = normalizeSparklineData(data);
    const padding = 2;
    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;

    // Calculate path points
    const points = normalized.map((value, index) => {
      const x = padding + (index / (normalized.length - 1)) * effectiveWidth;
      const y = padding + (1 - value) * effectiveHeight;
      return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;

    // Determine color based on trend direction
    const firstVal = data[0];
    const lastVal = data[data.length - 1];
    const change = firstVal !== 0 ? ((lastVal - firstVal) / Math.abs(firstVal)) * 100 : 0;

    let lineColor = stableColor;
    if (change > 0.5) lineColor = upColor;
    else if (change < -0.5) lineColor = downColor;

    return { path: pathD, color: lineColor };
  }, [data, width, height, upColor, downColor, stableColor]);

  if (data.length < 2) {
    return (
      <div
        className={`flex items-center justify-center text-[8px] text-on-surface-variant ${className}`}
        style={{ width, height }}
      >
        --
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
