'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

export function CycleDiagram({ section, report }: SectionProps) {
  const cycleData = report.populated_data?.cycle;
  const historicalPeak = cycleData?.historical_peak;
  const historicalTrough = cycleData?.historical_trough;
  const currentPrice = report.populated_data?.current?.zhvi as number;

  if (!historicalPeak && !historicalTrough) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Historical Context</h3>
        <p className="text-on-surface-variant text-center py-4">Historical cycle data not available</p>
      </div>
    );
  }

  const peakValue = historicalPeak?.value || 0;
  const troughValue = historicalTrough?.value || 0;
  const vsPeak = currentPrice ? ((currentPrice - peakValue) / peakValue) * 100 : 0;
  const vsTrough = currentPrice ? ((currentPrice - troughValue) / troughValue) * 100 : 0;

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">Historical Context</h3>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {historicalTrough && (
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <TrendingDown className="w-6 h-6 mx-auto mb-2 text-red-600" />
            <p className="text-sm text-red-600">Historical Low</p>
            <p className="text-lg font-bold text-red-700">{formatMetricValue('price', troughValue)}</p>
            <p className="text-xs text-red-500">{historicalTrough.date}</p>
          </div>
        )}

        <div className="text-center p-4 bg-primary/10 rounded-xl">
          <Activity className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-sm text-primary">Current</p>
          <p className="text-lg font-bold text-on-surface">{formatMetricValue('price', currentPrice)}</p>
          <p className="text-xs text-on-surface-variant">Today</p>
        </div>

        {historicalPeak && (
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <p className="text-sm text-green-600">Historical High</p>
            <p className="text-lg font-bold text-green-700">{formatMetricValue('price', peakValue)}</p>
            <p className="text-xs text-green-500">{historicalPeak.date}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={`p-3 rounded-xl ${vsPeak > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
          <p className={`text-center ${vsPeak > 0 ? 'text-green-700' : 'text-red-700'}`}>
            <span className="font-bold">{vsPeak > 0 ? '+' : ''}{vsPeak.toFixed(1)}%</span> vs peak
          </p>
        </div>
        <div className={`p-3 rounded-xl ${vsTrough > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
          <p className={`text-center ${vsTrough > 0 ? 'text-green-700' : 'text-red-700'}`}>
            <span className="font-bold">{vsTrough > 0 ? '+' : ''}{vsTrough.toFixed(1)}%</span> vs trough
          </p>
        </div>
      </div>
    </div>
  );
}
