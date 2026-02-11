'use client';

import React from 'react';
import { SectionProps } from '../types';
import { ChartSingle } from './ChartSingle';

export function ChartGrid({ section, report }: SectionProps) {
  const metrics = section.config?.metrics || [];
  const columns = section.config?.columns || 2;

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
