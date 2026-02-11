'use client';

import { AlertTriangle, Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { formatMetricValue, getMetricFormat } from '@/lib/data';

import type { SectionProps } from '../types';
import { getMetricWithAliases } from '../utils/metricHelpers';

export function MetricDetail({ section, report }: SectionProps) {
  const metricId = section.config?.metric;
  const value = getMetricWithAliases(report, metricId);
  const yoyKey = `${metricId}_yoy`;
  const yoyChange = report.populated_data?.current?.[yoyKey] as number | undefined;
  const description = section.config?.description || '';
  const label =
    section.config?.label ||
    metricId?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  if (value === null) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <p className="text-sm text-on-surface-variant mb-2">{label}</p>
        <div className="flex items-center gap-2 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>Data not available</span>
        </div>
      </div>
    );
  }

  function getTrendIcon() {
    if (yoyChange && yoyChange > 0) return TrendingUp;
    if (yoyChange && yoyChange < 0) return TrendingDown;
    return Minus;
  }

  function getTrendColor(): string {
    if (yoyChange && yoyChange > 0) return 'text-green-600';
    if (yoyChange && yoyChange < 0) return 'text-red-600';
    return 'text-on-surface-variant';
  }

  const TrendIcon = getTrendIcon();
  const trendColor = getTrendColor();
  const format = getMetricFormat(metricId);

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-on-surface-variant">{label}</p>
        {yoyChange != null && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="text-sm">
              {yoyChange > 0 ? '+' : ''}
              {(yoyChange * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-on-surface mb-2">
        {formatMetricValue(value, format)}
      </p>
      {description && <p className="text-sm text-on-surface-variant">{description}</p>}
    </div>
  );
}
