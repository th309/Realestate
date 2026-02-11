'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';

export function MetricGrid({ section, report }: SectionProps) {
  const metrics = section.config?.metrics || [];
  const columns = section.config?.columns || 3;

  return (
    <div className={`grid grid-cols-2 md:grid-cols-${columns} gap-4`}>
      {metrics.map((metricId: string) => {
        const value = report.populated_data?.current?.[metricId];
        const label = metricId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        return (
          <div key={metricId} className="bg-surface-container rounded-xl p-4">
            <p className="text-sm text-on-surface-variant mb-1">{label}</p>
            <p className="text-2xl font-semibold text-on-surface">
              {value != null ? formatMetricValue(metricId, value) : '--'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
