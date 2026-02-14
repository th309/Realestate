'use client';

import React from 'react';
import { TrendIndicator, SparklineTrend } from './TrendIndicator';
import { SkeletonStatCard } from '../ui/Skeleton';
import { InfoTooltip } from '../ui/Tooltip';
import { MetricLink } from '../ui/MetricLink';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: number;
  trendLabel?: string;
  trendInverted?: boolean;
  sparklineData?: number[];
  icon?: React.ReactNode;
  tooltip?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  variant?: 'default' | 'compact' | 'large';
  className?: string;
  /** Optional metric ID - when provided, the label becomes a clickable link */
  metricId?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  trend,
  trendLabel,
  trendInverted = false,
  sparklineData,
  icon,
  tooltip,
  loading = false,
  error,
  onRetry,
  variant = 'default',
  className = '',
  metricId,
}) => {
  // Helper to render label - either as MetricLink or plain text
  const renderLabel = (labelClassName: string) => {
    if (metricId) {
      return (
        <MetricLink metricId={metricId} className={labelClassName}>
          {label}
        </MetricLink>
      );
    }
    return <span className={labelClassName}>{label}</span>;
  };
  if (loading) {
    return <SkeletonStatCard className={className} />;
  }

  if (error) {
    return (
      <div
        className={`
          bg-error-container/30 border border-error/30 rounded-xl p-4
          ${className}
        `}
      >
        <div className="text-sm text-error mb-2">{error}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-error font-medium hover:underline"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          {icon && (
            <div className="p-1.5 bg-surface-container-highest rounded-lg">
              {icon}
            </div>
          )}
          <div>
            <div className="text-xs text-on-surface-variant">
              {renderLabel('text-xs text-on-surface-variant')}
            </div>
            <div className="text-sm font-medium text-on-surface">{value}</div>
          </div>
        </div>
        {trend !== undefined && (
          <TrendIndicator value={trend} size="sm" inverted={trendInverted} />
        )}
      </div>
    );
  }

  if (variant === 'large') {
    return (
      <div
        className={`
          bg-surface-container-low rounded-2xl p-6 elevation-1
          ${className}
        `}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            {renderLabel('text-sm font-medium text-on-surface-variant')}
            {tooltip && <InfoTooltip content={tooltip} />}
          </div>
          {icon && (
            <div className="p-2 bg-primary-container rounded-xl">{icon}</div>
          )}
        </div>

        <div className="text-3xl font-semibold text-on-surface mb-2">
          {value}
        </div>

        {(trend !== undefined || sparklineData) && (
          <div className="flex items-center gap-3">
            {trend !== undefined && (
              <TrendIndicator
                value={trend}
                size="md"
                inverted={trendInverted}
              />
            )}
            {trendLabel && (
              <span className="text-xs text-on-surface-variant">
                {trendLabel}
              </span>
            )}
            {sparklineData && (
              <SparklineTrend data={sparklineData} showValue={false} />
            )}
          </div>
        )}

        {subtext && (
          <div className="text-xs text-on-surface-variant mt-2">{subtext}</div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={`
        bg-surface-container-low rounded-xl p-4 elevation-1
        ${className}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {renderLabel('text-xs font-medium text-on-surface-variant')}
          {tooltip && <InfoTooltip content={tooltip} size="sm" />}
        </div>
        {icon && (
          <div className="p-1.5 bg-primary-container rounded-lg text-on-primary-container">
            {icon}
          </div>
        )}
      </div>

      <div className="text-xl font-semibold text-on-surface mb-1">{value}</div>

      {(trend !== undefined || sparklineData) && (
        <div className="flex items-center gap-2">
          {trend !== undefined && (
            <TrendIndicator value={trend} size="sm" inverted={trendInverted} />
          )}
          {trendLabel && (
            <span className="text-xs text-on-surface-variant">{trendLabel}</span>
          )}
          {sparklineData && (
            <SparklineTrend data={sparklineData} width={48} height={16} showValue={false} />
          )}
        </div>
      )}

      {subtext && (
        <div className="text-xs text-on-surface-variant mt-1">{subtext}</div>
      )}
    </div>
  );
};

// Stat card grid for multiple stats
interface StatGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export const StatGrid: React.FC<StatGridProps> = ({
  children,
  columns = 3,
  className = '',
}) => {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>
      {children}
    </div>
  );
};

// Mini stat for inline display
interface MiniStatProps {
  label: string;
  value: string | number;
  trend?: number;
  trendInverted?: boolean;
  className?: string;
}

export const MiniStat: React.FC<MiniStatProps> = ({
  label,
  value,
  trend,
  trendInverted = false,
  className = '',
}) => {
  return (
    <div className={`text-center ${className}`}>
      <div className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className="text-sm font-semibold text-on-surface">{value}</div>
      {trend !== undefined && (
        <TrendIndicator
          value={trend}
          size="sm"
          inverted={trendInverted}
          showIcon={false}
        />
      )}
    </div>
  );
};
