'use client';

import { AlertTriangle } from 'lucide-react';

import { formatMetricValue, getMetricFormat } from '@/lib/data';

import type { SectionProps } from '../types';
import { getMetricWithAliases } from '../utils/metricHelpers';

export function MetricGrid({ section, report }: SectionProps) {
  const metrics = section.config?.metrics || [];
  const columns = section.config?.columns || 3;

  interface MetricWithValue {
    metricId: string;
    value: number | null;
    label: string;
  }

  const metricsWithValues: MetricWithValue[] = metrics.map((metricId: string) => ({
    metricId,
    value: getMetricWithAliases(report, metricId),
    label: metricId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
  }));

  const hasAnyData = metricsWithValues.some((m: MetricWithValue) => m.value !== null);

  if (!hasAnyData) {
    return (
      <div className="bg-surface-container rounded-xl p-6">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>Data not available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-${columns} gap-4`}>
      {metricsWithValues.map(({ metricId, value, label }) => {
        const format = getMetricFormat(metricId);

        return (
          <div key={metricId} className="bg-surface-container rounded-xl p-4">
            <p className="text-sm text-on-surface-variant mb-1">{label}</p>
            <p className="text-2xl font-semibold text-on-surface">
              {value !== null ? (
                formatMetricValue(value, format)
              ) : (
                <span className="text-on-surface-variant text-base">N/A</span>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
