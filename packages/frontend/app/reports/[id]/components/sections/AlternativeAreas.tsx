'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { MapPin, TrendingDown, ArrowRight } from 'lucide-react';

export function AlternativeAreas({ section, report }: SectionProps) {
  const alternatives = report.populated_data?.comparables || [];
  const currentPrice = report.populated_data?.current?.zhvi as number || 0;

  // Sort by price ascending
  const sortedAlternatives = [...alternatives]
    .filter(a => (a.metrics?.zhvi || 0) < currentPrice)
    .sort((a, b) => (a.metrics?.zhvi || 0) - (b.metrics?.zhvi || 0))
    .slice(0, 5);

  if (sortedAlternatives.length === 0) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          More Affordable Alternatives
        </h3>
        <p className="text-on-surface-variant text-center py-4">
          No cheaper alternatives found in comparable areas.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-primary" />
        More Affordable Alternatives
      </h3>

      <div className="space-y-3">
        {sortedAlternatives.map((alt) => {
          const savings = currentPrice - (alt.metrics?.zhvi || 0);
          const savingsPct = (savings / currentPrice) * 100;

          return (
            <div key={alt.geography.id} className="flex items-center justify-between p-3 bg-surface rounded-xl">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-on-surface-variant" />
                <div>
                  <p className="font-medium text-on-surface">{alt.geography.name}</p>
                  <p className="text-sm text-on-surface-variant">{alt.geography.state}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-on-surface">{formatMetricValue('price', alt.metrics?.zhvi)}</p>
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Save {savingsPct.toFixed(0)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
