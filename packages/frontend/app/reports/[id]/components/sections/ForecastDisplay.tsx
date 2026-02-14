'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Clock, AlertTriangle } from 'lucide-react';
import { formatMetricValue } from '@/lib/data';
import { getMetricWithAliases } from '../utils/metricHelpers';
import type { SectionProps } from '../types';

function getTrendIcon(pct: number): typeof TrendingUp {
  if (pct > 1) return TrendingUp;
  if (pct < -1) return TrendingDown;
  return Minus;
}

function getTrendColor(pct: number): string {
  if (pct > 3) return 'text-green-600 bg-green-100';
  if (pct > 0) return 'text-green-500 bg-green-50';
  if (pct > -3) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}

export function ForecastDisplay({ section: _section, report }: SectionProps): React.ReactElement {
  const forecast1yr = getMetricWithAliases(report, 'zhvf_1yr_pct');
  const currentPrice = getMetricWithAliases(report, 'zhvi');

  // Check for missing required data
  if (currentPrice === null) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          12-Month Forecast
        </h3>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant py-8">
          <AlertTriangle className="w-5 h-5" />
          <span>Home value data not available for forecast</span>
        </div>
      </div>
    );
  }

  const forecastPercent = forecast1yr ?? 0;
  const forecastPrice = currentPrice * (1 + forecastPercent / 100);

  const TrendIcon = getTrendIcon(forecastPercent);
  const colors = getTrendColor(forecastPercent);
  const [textColor, bgColor] = colors.split(' ');

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        12-Month Forecast
      </h3>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="text-center">
          <p className="text-sm text-on-surface-variant mb-2">Current Value</p>
          <p className="text-3xl font-bold text-on-surface">
            {formatMetricValue(currentPrice, 'currency')}
          </p>
        </div>

        <div className="text-center">
          <p className="text-sm text-on-surface-variant mb-2">Forecasted Value</p>
          <p className="text-3xl font-bold text-on-surface">
            {forecast1yr !== null
              ? formatMetricValue(forecastPrice, 'currency')
              : 'N/A'}
          </p>
        </div>
      </div>

      <div className={`mt-6 p-4 rounded-xl ${bgColor} flex items-center justify-center gap-3`}>
        <TrendIcon className={`w-6 h-6 ${textColor}`} />
        <span className={`text-xl font-bold ${textColor}`}>
          {forecast1yr !== null
            ? `${forecast1yr > 0 ? '+' : ''}${forecast1yr.toFixed(1)}%`
            : 'N/A'}
        </span>
        <span className="text-on-surface-variant">expected change</span>
      </div>

      <p className="mt-4 text-xs text-on-surface-variant text-center">
        Forecast based on Zillow Home Value Forecast (ZHVF)
      </p>
    </div>
  );
}
