'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { getMetricWithAliases } from '../utils/metricHelpers';
import { MapPin, TrendingDown, AlertTriangle } from 'lucide-react';

export function AlternativeAreas({
  section,
  report,
}: SectionProps): React.ReactElement {
  const currentPrice =
    getMetricWithAliases(report, 'zhvi') ??
    getMetricWithAliases(report, 'median_listing_price');

  const alternatives = report.populated_data?.comparables ?? [];

  if (!currentPrice) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          More Affordable Alternatives
        </h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <p>Data not available for this location</p>
        </div>
      </div>
    );
  }

  const sortedAlternatives = [...alternatives]
    .filter((a) => {
      const altPrice = a.metrics?.zhvi ?? a.metrics?.median_listing_price ?? 0;
      return altPrice < currentPrice;
    })
    .sort((a, b) => {
      const priceA = a.metrics?.zhvi ?? a.metrics?.median_listing_price ?? 0;
      const priceB = b.metrics?.zhvi ?? b.metrics?.median_listing_price ?? 0;
      return priceA - priceB;
    })
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
          const altPrice =
            alt.metrics?.zhvi ?? alt.metrics?.median_listing_price ?? 0;
          const savings = currentPrice - altPrice;
          const savingsPct = (savings / currentPrice) * 100;

          return (
            <div
              key={alt.geography.id}
              className="flex items-center justify-between p-3 bg-surface rounded-xl"
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-on-surface-variant" />
                <div>
                  <p className="font-medium text-on-surface">
                    {alt.geography.name}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {alt.geography.state}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-on-surface">
                  {formatMetricValue(altPrice, 'currency')}
                </p>
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
