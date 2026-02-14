'use client';

import React from 'react';
import { SectionProps } from '../types';
import { BarChart3, AlertTriangle } from 'lucide-react';

export function PercentileRank({ section, report }: SectionProps): React.ReactElement {
  const label = section.config?.label || 'Score';

  // Get percentile from scores - try both possible score types
  const homereadyPercentile = report.populated_data?.scores?.homeready?.percentile;
  const investoredgePercentile = report.populated_data?.scores?.investoredge?.percentile;
  const percentile = homereadyPercentile ?? investoredgePercentile ?? null;

  // Check if data is available
  if (percentile === null) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          {label} Ranking
        </h3>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant py-8">
          <AlertTriangle className="w-5 h-5" />
          <span>Percentile ranking data not available</span>
        </div>
      </div>
    );
  }

  const getPercentileLabel = (p: number): { text: string; color: string } => {
    if (p >= 90) return { text: 'Top 10%', color: 'text-green-600' };
    if (p >= 75) return { text: 'Top 25%', color: 'text-green-500' };
    if (p >= 50) return { text: 'Above Average', color: 'text-blue-600' };
    if (p >= 25) return { text: 'Below Average', color: 'text-yellow-600' };
    return { text: 'Bottom 25%', color: 'text-red-600' };
  };

  const status = getPercentileLabel(percentile);

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        {label} Ranking
      </h3>

      <div className="text-center mb-4">
        <p className="text-5xl font-bold text-primary mb-1">{percentile}</p>
        <p className="text-on-surface-variant">percentile</p>
        <p className={`font-semibold ${status.color}`}>{status.text}</p>
      </div>

      <div className="relative h-4 bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 rounded-full">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-on-surface rounded-full shadow-md"
          style={{ left: `${percentile}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-on-surface-variant">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}
