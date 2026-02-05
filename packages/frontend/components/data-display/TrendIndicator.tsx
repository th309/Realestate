'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type TrendDirection = 'up' | 'down' | 'neutral';
type TrendSize = 'sm' | 'md' | 'lg';

interface TrendIndicatorProps {
  value: number;
  format?: 'percent' | 'number' | 'currency';
  showIcon?: boolean;
  showValue?: boolean;
  size?: TrendSize;
  inverted?: boolean; // For metrics where down is good (e.g., days on market)
  className?: string;
}

const sizeStyles: Record<TrendSize, { text: string; icon: string }> = {
  sm: { text: 'text-xs', icon: 'w-3 h-3' },
  md: { text: 'text-sm', icon: 'w-4 h-4' },
  lg: { text: 'text-base', icon: 'w-5 h-5' },
};

export const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  value,
  format = 'percent',
  showIcon = true,
  showValue = true,
  size = 'md',
  inverted = false,
  className = '',
}) => {
  // Determine direction
  const rawDirection: TrendDirection = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
  const displayDirection = inverted
    ? rawDirection === 'up'
      ? 'down'
      : rawDirection === 'down'
      ? 'up'
      : 'neutral'
    : rawDirection;

  // Format value
  const formatValue = () => {
    const absValue = Math.abs(value);
    switch (format) {
      case 'percent':
        return `${absValue.toFixed(1)}%`;
      case 'currency':
        return `$${absValue.toLocaleString()}`;
      case 'number':
      default:
        return absValue.toLocaleString();
    }
  };

  // Get color based on direction
  const colorClass =
    displayDirection === 'up'
      ? 'text-green-600'
      : displayDirection === 'down'
      ? 'text-red-600'
      : 'text-on-surface-variant';

  const bgClass =
    displayDirection === 'up'
      ? 'bg-green-50'
      : displayDirection === 'down'
      ? 'bg-red-50'
      : 'bg-surface-container';

  // Get icon
  const Icon =
    rawDirection === 'up'
      ? TrendingUp
      : rawDirection === 'down'
      ? TrendingDown
      : Minus;

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5 rounded
        ${colorClass} ${bgClass}
        ${sizeStyles[size].text}
        font-medium
        ${className}
      `}
    >
      {showIcon && <Icon className={sizeStyles[size].icon} />}
      {showValue && (
        <span>
          {rawDirection === 'up' ? '+' : rawDirection === 'down' ? '' : ''}
          {formatValue()}
        </span>
      )}
    </span>
  );
};

// Compact trend arrow only
interface TrendArrowProps {
  direction: TrendDirection;
  size?: TrendSize;
  inverted?: boolean;
  className?: string;
}

export const TrendArrow: React.FC<TrendArrowProps> = ({
  direction,
  size = 'md',
  inverted = false,
  className = '',
}) => {
  const displayDirection = inverted
    ? direction === 'up'
      ? 'down'
      : direction === 'down'
      ? 'up'
      : 'neutral'
    : direction;

  const colorClass =
    displayDirection === 'up'
      ? 'text-green-600'
      : displayDirection === 'down'
      ? 'text-red-600'
      : 'text-on-surface-variant';

  const Icon =
    direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  return <Icon className={`${sizeStyles[size].icon} ${colorClass} ${className}`} />;
};

// Trend badge with label
interface TrendBadgeProps {
  value: number;
  label?: string;
  format?: 'percent' | 'number';
  period?: string;
  inverted?: boolean;
  className?: string;
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({
  value,
  label,
  format = 'percent',
  period,
  inverted = false,
  className = '',
}) => {
  const direction: TrendDirection = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
  const displayDirection = inverted
    ? direction === 'up'
      ? 'down'
      : direction === 'down'
      ? 'up'
      : 'neutral'
    : direction;

  const colorClass =
    displayDirection === 'up'
      ? 'text-green-700 bg-green-100 border-green-200'
      : displayDirection === 'down'
      ? 'text-red-700 bg-red-100 border-red-200'
      : 'text-on-surface-variant bg-surface-container border-outline-variant';

  const Icon =
    direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  const formatValue = () => {
    const absValue = Math.abs(value);
    return format === 'percent'
      ? `${absValue.toFixed(1)}%`
      : absValue.toLocaleString();
  };

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border
        ${colorClass}
        ${className}
      `}
    >
      <Icon className="w-4 h-4" />
      <div>
        <div className="text-sm font-medium">
          {direction === 'up' ? '+' : ''}
          {formatValue()}
        </div>
        {(label || period) && (
          <div className="text-xs opacity-75">
            {label}
            {label && period && ' '}
            {period}
          </div>
        )}
      </div>
    </div>
  );
};

// Sparkline trend indicator
interface SparklineTrendProps {
  data: number[];
  width?: number;
  height?: number;
  showValue?: boolean;
  className?: string;
}

export const SparklineTrend: React.FC<SparklineTrendProps> = ({
  data,
  width = 60,
  height = 20,
  showValue = true,
  className = '',
}) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Normalize data to fit in height
  const normalize = (val: number) =>
    height - 2 - ((val - min) / range) * (height - 4);

  // Create path
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = normalize(val);
    return `${x},${y}`;
  });
  const pathD = `M ${points.join(' L ')}`;

  // Determine trend from first to last
  const firstVal = data[0];
  const lastVal = data[data.length - 1];
  const change = ((lastVal - firstVal) / firstVal) * 100;
  const direction: TrendDirection =
    change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'neutral';

  const strokeColor =
    direction === 'up'
      ? '#16a34a'
      : direction === 'down'
      ? '#dc2626'
      : '#6b7280';

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End dot */}
        <circle
          cx={width}
          cy={normalize(lastVal)}
          r="2"
          fill={strokeColor}
        />
      </svg>
      {showValue && (
        <TrendIndicator value={change} size="sm" showIcon={false} />
      )}
    </div>
  );
};
