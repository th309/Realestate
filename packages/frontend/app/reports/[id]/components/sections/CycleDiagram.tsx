'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import { getMetricWithAliases } from '../utils/metricHelpers';

export function CycleDiagram({ section, report }: SectionProps): React.ReactElement {
  const cycleData = report.populated_data?.cycle;
  const historicalPeak = cycleData?.historical_peak;
  const historicalTrough = cycleData?.historical_trough;
  const currentPrice = getMetricWithAliases(report, 'zhvi');

  // Check if we have sufficient data to display
  const hasHistoricalData = historicalPeak || historicalTrough;
  const hasCurrentPrice = currentPrice !== null;

  if (!hasHistoricalData && !hasCurrentPrice) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Historical Context</h3>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant py-8">
          <AlertTriangle className="w-5 h-5" />
          <span>Historical cycle data not available</span>
        </div>
      </div>
    );
  }

  const peakValue = historicalPeak?.value ?? null;
  const troughValue = historicalTrough?.value ?? null;

  // Calculate comparisons only if we have the required values
  const vsPeak = currentPrice !== null && peakValue !== null
    ? ((currentPrice - peakValue) / peakValue) * 100
    : null;
  const vsTrough = currentPrice !== null && troughValue !== null
    ? ((currentPrice - troughValue) / troughValue) * 100
    : null;

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">Historical Context</h3>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {troughValue !== null && (
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <TrendingDown className="w-6 h-6 mx-auto mb-2 text-red-600" />
            <p className="text-sm text-red-600">Historical Low</p>
            <p className="text-lg font-bold text-red-700">{formatMetricValue(troughValue, 'currency')}</p>
            <p className="text-xs text-red-500">{historicalTrough?.date}</p>
          </div>
        )}

        {hasCurrentPrice ? (
          <div className="text-center p-4 bg-primary/10 rounded-xl">
            <Activity className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-sm text-primary">Current</p>
            <p className="text-lg font-bold text-on-surface">{formatMetricValue(currentPrice, 'currency')}</p>
            <p className="text-xs text-on-surface-variant">Today</p>
          </div>
        ) : (
          <div className="text-center p-4 bg-surface rounded-xl">
            <Activity className="w-6 h-6 mx-auto mb-2 text-on-surface-variant" />
            <p className="text-sm text-on-surface-variant">Current</p>
            <p className="text-lg font-bold text-on-surface-variant">—</p>
            <p className="text-xs text-on-surface-variant">Not available</p>
          </div>
        )}

        {peakValue !== null && (
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <p className="text-sm text-green-600">Historical High</p>
            <p className="text-lg font-bold text-green-700">{formatMetricValue(peakValue, 'currency')}</p>
            <p className="text-xs text-green-500">{historicalPeak?.date}</p>
          </div>
        )}
      </div>

      {(vsPeak !== null || vsTrough !== null) && (
        <div className="grid grid-cols-2 gap-4">
          {vsPeak !== null && (
            <div className={`p-3 rounded-xl ${vsPeak > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <p className={`text-center ${vsPeak > 0 ? 'text-green-700' : 'text-red-700'}`}>
                <span className="font-bold">{vsPeak > 0 ? '+' : ''}{vsPeak.toFixed(1)}%</span> vs peak
              </p>
            </div>
          )}
          {vsTrough !== null && (
            <div className={`p-3 rounded-xl ${vsTrough > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <p className={`text-center ${vsTrough > 0 ? 'text-green-700' : 'text-red-700'}`}>
                <span className="font-bold">{vsTrough > 0 ? '+' : ''}{vsTrough.toFixed(1)}%</span> vs trough
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
