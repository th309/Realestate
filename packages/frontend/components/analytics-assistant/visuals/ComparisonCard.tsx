'use client';

/**
 * Comparison Card for Analytics Assistant
 *
 * Shows filtered data compared to a benchmark (national average, etc.)
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';

export interface ComparisonMetric {
  label: string;
  filtered: number | null;
  benchmark: number | null;
  unit?: 'score' | 'percent' | 'number';
  higherIsBetter?: boolean;
}

export interface ComparisonConfig {
  title?: string;
  filteredLabel: string;
  benchmarkLabel: string;
  metrics: ComparisonMetric[];
}

function formatMetricValue(
  value: number | null,
  unit: ComparisonMetric['unit']
): string {
  if (value === null) return '—';

  switch (unit) {
    case 'percent':
      return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
    case 'score':
      return value.toFixed(1);
    default:
      return value.toLocaleString();
  }
}

function MetricRow({
  metric,
  filteredLabel,
  benchmarkLabel,
}: {
  metric: ComparisonMetric;
  filteredLabel: string;
  benchmarkLabel: string;
}) {
  const { label, filtered, benchmark, unit = 'number', higherIsBetter = true } = metric;

  const diff =
    filtered !== null && benchmark !== null ? filtered - benchmark : null;

  const isPositive = diff !== null && (higherIsBetter ? diff > 0 : diff < 0);
  const isNegative = diff !== null && (higherIsBetter ? diff < 0 : diff > 0);

  const diffColor = isPositive
    ? 'text-green-600 dark:text-green-400'
    : isNegative
      ? 'text-red-600 dark:text-red-400'
      : 'text-on-surface-variant';

  const DiffIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div className="py-3 border-b border-outline-variant last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-on-surface">{label}</span>
        {diff !== null && (
          <span className={`flex items-center gap-1 text-xs font-medium ${diffColor}`}>
            <DiffIcon className="w-3 h-3" />
            {unit === 'percent'
              ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}pp`
              : diff > 0
                ? `+${diff.toFixed(1)}`
                : diff.toFixed(1)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="text-xs text-on-surface-variant mb-0.5">{filteredLabel}</div>
          <div className="text-lg font-semibold text-on-surface">
            {formatMetricValue(filtered, unit)}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-on-surface-variant mb-0.5">{benchmarkLabel}</div>
          <div className="text-lg font-semibold text-on-surface-variant">
            {formatMetricValue(benchmark, unit)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComparisonCard({ config }: { config: ComparisonConfig }) {
  const { title, filteredLabel, benchmarkLabel, metrics } = config;

  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 bg-surface-container rounded-lg">
        <p className="text-on-surface-variant text-sm">No comparison data</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-medium text-on-surface">{title}</h4>
        </div>
      )}
      <div className="bg-surface-container rounded-lg p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-outline-variant">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {filteredLabel}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            vs {benchmarkLabel}
          </span>
        </div>
        {metrics.map((metric, index) => (
          <MetricRow
            key={index}
            metric={metric}
            filteredLabel={filteredLabel}
            benchmarkLabel={benchmarkLabel}
          />
        ))}
      </div>
    </div>
  );
}
