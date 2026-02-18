'use client';

import React from 'react';

interface ScoreTrendSparklineProps {
  /** Array of score values over time (oldest to newest) */
  data: number[];
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Line color - defaults to primary color */
  color?: string;
  className?: string;
}

export function ScoreTrendSparkline({
  data,
  width = 60,
  height = 24,
  color = 'var(--color-primary, #6750A4)',
  className = '',
}: ScoreTrendSparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = padding + (1 - (value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  // Determine trend color: green if last > first, red if last < first
  const trendUp = data[data.length - 1] > data[0];
  const trendColor = trendUp ? '#16a34a' : data[data.length - 1] < data[0] ? '#dc2626' : color;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={trendColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
