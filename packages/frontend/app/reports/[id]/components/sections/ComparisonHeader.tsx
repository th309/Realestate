'use client';

import React from 'react';
import type { ReportInstance } from '../../../types';
import { MapPin, AlertTriangle } from 'lucide-react';

interface ComparisonHeaderProps {
  report: ReportInstance;
}

export function ComparisonHeader({ report }: ComparisonHeaderProps) {
  const geographies = [
    { name: report.primary_geography_name, type: report.primary_geography_type },
    ...(report.comparison_geographies || []),
  ];

  const hasComparisonData = geographies.length > 1;

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h2 className="text-xl font-bold text-on-surface mb-4">Market Comparison</h2>
      {hasComparisonData ? (
        <div className="flex flex-wrap gap-3">
          {geographies.map((geo, index) => (
            <div
              key={geo.name}
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                index === 0 ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{geo.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-4 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>No comparison geographies available</span>
        </div>
      )}
    </div>
  );
}
