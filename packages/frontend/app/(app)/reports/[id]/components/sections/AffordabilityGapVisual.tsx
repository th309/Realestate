'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { getMetricWithAliases } from '../utils/metricHelpers';
import { Home, DollarSign, AlertCircle, AlertTriangle } from 'lucide-react';

export function AffordabilityGapVisual({
  section,
  report,
}: SectionProps): React.ReactElement {
  const medianPrice =
    getMetricWithAliases(report, 'zhvi') ??
    getMetricWithAliases(report, 'median_listing_price');

  const medianIncome = getMetricWithAliases(report, 'median_household_income');

  if (!medianPrice || !medianIncome) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">
          Affordability Gap
        </h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <p>Affordability data not available for this location</p>
        </div>
      </div>
    );
  }

  const affordablePrice = medianIncome * 4;
  const gap = medianPrice - affordablePrice;
  const gapPercent =
    affordablePrice > 0 ? (medianPrice / affordablePrice - 1) * 100 : 0;

  const isAffordable = gap <= 0;

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">
        Affordability Gap
      </h3>

      <div className="flex items-center justify-between mb-6">
        <div className="text-center">
          <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-600" />
          <p className="text-sm text-on-surface-variant">Affordable Price</p>
          <p className="text-xl font-bold text-green-600">
            {formatMetricValue(affordablePrice, 'currency')}
          </p>
          <p className="text-xs text-on-surface-variant">Based on median income</p>
        </div>

        <div className="flex-1 mx-4 relative">
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className={`h-full rounded-full ${isAffordable ? 'bg-green-500' : 'bg-red-500'}`}
              style={{
                width: `${Math.min(100, (affordablePrice / medianPrice) * 100)}%`,
              }}
            />
          </div>
          {!isAffordable && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
          )}
        </div>

        <div className="text-center">
          <Home className="w-8 h-8 mx-auto mb-2 text-primary" />
          <p className="text-sm text-on-surface-variant">Median Price</p>
          <p className="text-xl font-bold text-on-surface">
            {formatMetricValue(medianPrice, 'currency')}
          </p>
          <p className="text-xs text-on-surface-variant">Current market</p>
        </div>
      </div>

      <div
        className={`p-4 rounded-xl ${isAffordable ? 'bg-green-100' : 'bg-red-100'}`}
      >
        <p
          className={`text-center font-semibold ${isAffordable ? 'text-green-700' : 'text-red-700'}`}
        >
          {isAffordable
            ? 'Market is affordable for median income households'
            : `Gap: ${formatMetricValue(gap, 'currency')} (${gapPercent.toFixed(0)}% above affordable)`}
        </p>
      </div>
    </div>
  );
}
