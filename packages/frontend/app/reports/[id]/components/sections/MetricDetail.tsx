'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function MetricDetail({ section, report }: SectionProps) {
  const metricId = section.config?.metric;
  const value = report.populated_data?.current?.[metricId];
  const yoyKey = `${metricId}_yoy`;
  const yoyChange = report.populated_data?.current?.[yoyKey] as number | undefined;
  const description = section.config?.description || '';
  const label = section.config?.label || metricId?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  const TrendIcon = yoyChange && yoyChange > 0 ? TrendingUp : yoyChange && yoyChange < 0 ? TrendingDown : Minus;
  const trendColor = yoyChange && yoyChange > 0 ? 'text-green-600' : yoyChange && yoyChange < 0 ? 'text-red-600' : 'text-on-surface-variant';

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-on-surface-variant">{label}</p>
        {yoyChange != null && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="text-sm">{yoyChange > 0 ? '+' : ''}{(yoyChange * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-on-surface mb-2">
        {value != null ? formatMetricValue(metricId, value) : '--'}
      </p>
      {description && (
        <p className="text-sm text-on-surface-variant">{description}</p>
      )}
    </div>
  );
}
