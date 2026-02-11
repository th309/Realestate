'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

export function ForecastDisplay({ section, report }: SectionProps) {
  const forecast1yr = report.populated_data?.current?.zhvf_1yr_pct as number;
  const currentPrice = report.populated_data?.current?.zhvi as number || 0;
  const forecastPrice = currentPrice * (1 + (forecast1yr || 0) / 100);

  const getTrendIcon = (pct: number) => {
    if (pct > 1) return TrendingUp;
    if (pct < -1) return TrendingDown;
    return Minus;
  };

  const getTrendColor = (pct: number) => {
    if (pct > 3) return 'text-green-600 bg-green-100';
    if (pct > 0) return 'text-green-500 bg-green-50';
    if (pct > -3) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const TrendIcon = getTrendIcon(forecast1yr || 0);
  const colors = getTrendColor(forecast1yr || 0);

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        12-Month Forecast
      </h3>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="text-center">
          <p className="text-sm text-on-surface-variant mb-2">Current Value</p>
          <p className="text-3xl font-bold text-on-surface">{formatMetricValue('price', currentPrice)}</p>
        </div>

        <div className="text-center">
          <p className="text-sm text-on-surface-variant mb-2">Forecasted Value</p>
          <p className="text-3xl font-bold text-on-surface">{formatMetricValue('price', forecastPrice)}</p>
        </div>
      </div>

      <div className={`mt-6 p-4 rounded-xl ${colors.split(' ')[1]} flex items-center justify-center gap-3`}>
        <TrendIcon className={`w-6 h-6 ${colors.split(' ')[0]}`} />
        <span className={`text-xl font-bold ${colors.split(' ')[0]}`}>
          {forecast1yr != null ? `${forecast1yr > 0 ? '+' : ''}${forecast1yr.toFixed(1)}%` : 'N/A'}
        </span>
        <span className="text-on-surface-variant">expected change</span>
      </div>

      <p className="mt-4 text-xs text-on-surface-variant text-center">
        Forecast based on Zillow Home Value Forecast (ZHVF)
      </p>
    </div>
  );
}
