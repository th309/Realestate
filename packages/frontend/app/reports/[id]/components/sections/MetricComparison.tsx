'use client';

import { AlertTriangle } from 'lucide-react';

import { formatMetricValue, getMetricFormat } from '@/lib/data';
import { MetricTitle } from '@/app/components/MetricTitle';

import type { SectionProps } from '../types';
import { getMetricWithAliases } from '../utils/metricHelpers';

export function MetricComparison({ section, report }: SectionProps) {
  const metricId = section.config?.metric;
  const label =
    section.config?.label ||
    metricId?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  const primaryValue = getMetricWithAliases(report, metricId);
  const nationalValue = report.populated_data?.benchmarks?.national?.[metricId] as
    | number
    | undefined;
  const stateValue = report.populated_data?.benchmarks?.state?.[metricId] as
    | number
    | undefined;

  const comparisons = [
    { name: report.primary_geography_name, value: primaryValue, highlight: true },
    { name: 'National', value: nationalValue ?? null },
    { name: 'State', value: stateValue ?? null },
  ].filter((c) => c.value !== null);

  if (comparisons.length === 0) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">{metricId ? <MetricTitle metricId={metricId} /> : label}</h3>
        <div className="flex items-center gap-2 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>Data not available</span>
        </div>
      </div>
    );
  }

  const format = getMetricFormat(metricId);

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">{metricId ? <MetricTitle metricId={metricId} /> : label}</h3>
      <div className="space-y-3">
        {comparisons.map((comp) => (
          <div
            key={comp.name}
            className={`flex justify-between items-center p-3 rounded-xl ${
              comp.highlight ? 'bg-primary/10' : 'bg-surface'
            }`}
          >
            <span className="text-on-surface">{comp.name}</span>
            <span
              className={`font-semibold ${comp.highlight ? 'text-primary' : 'text-on-surface'}`}
            >
              {formatMetricValue(comp.value, format)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
