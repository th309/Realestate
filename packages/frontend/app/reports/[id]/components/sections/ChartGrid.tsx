'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ChartSingle } from './ChartSingle';
import type { SectionProps } from '../types';

export function ChartGrid({ section, report }: SectionProps): React.ReactElement {
  const metrics = section.config?.metrics;
  const columns = section.config?.columns || 2;

  // Check for missing metrics configuration
  if (!metrics || metrics.length === 0) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>No metrics configured for chart grid</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-4`}>
      {metrics.map((metricId: string) => (
        <ChartSingle
          key={metricId}
          section={{ ...section, config: { ...section.config, metric: metricId } }}
          report={report}
        />
      ))}
    </div>
  );
}
