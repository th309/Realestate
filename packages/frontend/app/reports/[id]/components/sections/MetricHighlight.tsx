'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';

export function MetricHighlight({ section, report }: SectionProps) {
  const metricId = section.config?.metric;
  const value = report.populated_data?.current?.[metricId];
  const label = section.config?.label || metricId?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const subtitle = section.config?.subtitle;
  const icon = section.config?.icon;

  return (
    <div className="bg-primary/10 rounded-2xl p-6 text-center">
      {icon && <div className="text-4xl mb-2">{icon}</div>}
      <p className="text-sm text-primary font-medium mb-1">{label}</p>
      <p className="text-4xl font-bold text-on-surface mb-1">
        {value != null ? formatMetricValue(metricId, value) : '--'}
      </p>
      {subtitle && <p className="text-sm text-on-surface-variant">{subtitle}</p>}
    </div>
  );
}
