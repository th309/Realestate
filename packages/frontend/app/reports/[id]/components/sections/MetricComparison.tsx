'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';

export function MetricComparison({ section, report }: SectionProps) {
  const metricId = section.config?.metric;
  const label = section.config?.label || metricId?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  const primaryValue = report.populated_data?.current?.[metricId];
  const nationalValue = report.populated_data?.benchmarks?.national?.[metricId];
  const stateValue = report.populated_data?.benchmarks?.state?.[metricId];

  const comparisons = [
    { name: report.primary_geography_name, value: primaryValue, highlight: true },
    { name: 'National', value: nationalValue },
    { name: 'State', value: stateValue },
  ].filter(c => c.value != null);

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">{label}</h3>
      <div className="space-y-3">
        {comparisons.map((comp) => (
          <div key={comp.name} className={`flex justify-between items-center p-3 rounded-xl ${comp.highlight ? 'bg-primary/10' : 'bg-surface'}`}>
            <span className="text-on-surface">{comp.name}</span>
            <span className={`font-semibold ${comp.highlight ? 'text-primary' : 'text-on-surface'}`}>
              {formatMetricValue(metricId, comp.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
