'use client';

import type { GeoLevel, ForecastHorizon, HomeValues } from '../types';
import {
  COLOR_SCALE,
  getMetricFormat,
  getMetricTitle,
  calculateValueRange,
  formatValue,
} from '../utils';

interface LegendProps {
  selectedMetric: string;
  forecastHorizon: ForecastHorizon;
  geoLevel: GeoLevel;
  homeValues: HomeValues;
}

export function Legend({
  selectedMetric,
  forecastHorizon,
  geoLevel,
  homeValues,
}: LegendProps) {
  const metricFormat = getMetricFormat(selectedMetric);
  const legendTitle = getMetricTitle(selectedMetric, forecastHorizon);
  const isForecast = selectedMetric === 'home_price_forecast';

  // Use shared range calculation - ensures consistency with map layer colors
  // Pass selectedMetric for special handling (e.g., market_heat uses full range)
  const { min, max } = calculateValueRange(homeValues, metricFormat, selectedMetric);

  // Use shared formatValue for labels - ensures consistency with map
  const minLabel = formatValue(min, metricFormat, 'min');
  const maxLabel = formatValue(max, metricFormat, 'max');

  // Percent legend (forecasts, growth rates)
  if (metricFormat === 'percent') {
    return (
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2">{legendTitle}</div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.slice(0, 6).map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        {isForecast && (geoLevel === 'state' || geoLevel === 'national' || geoLevel === 'county') && (
          <div className="mt-1.5 md:mt-2 pt-1.5 md:pt-2 border-t border-outline-variant text-[10px] md:text-xs text-amber-600">
            Forecast data available for Metro and ZIP levels
          </div>
        )}
        <NoDataIndicator />
      </div>
    );
  }

  // Absolute percent legend (affordability, rates - 0-100%)
  if (metricFormat === 'percent_abs') {
    return (
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2">{legendTitle}</div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator />
      </div>
    );
  }

  // Index legend (renter demand, cost of living)
  if (metricFormat === 'index') {
    return (
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2">{legendTitle}</div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator />
      </div>
    );
  }

  // Number legend (inventory, listings, population)
  if (metricFormat === 'number') {
    return (
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2">{legendTitle}</div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator />
      </div>
    );
  }

  // Days legend (days on market, days to close)
  if (metricFormat === 'days') {
    return (
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2">{legendTitle}</div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator />
      </div>
    );
  }

  // Currency legend (home values, prices, rent, income) - default

  return (
    <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
      <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2">{legendTitle}</div>
      <div className="flex items-center gap-0.5 md:gap-1">
        {COLOR_SCALE.map((color, i) => (
          <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <NoDataIndicator />
    </div>
  );
}

function NoDataIndicator() {
  return (
    <div className="flex items-center gap-1.5 md:gap-2 mt-2 md:mt-3 pt-2 md:pt-3 border-t border-outline-variant">
      <div className="w-4 md:w-6 h-3 md:h-4 rounded border border-outline" style={{ backgroundColor: 'rgba(200, 200, 200, 0.5)' }} />
      <span className="text-[10px] md:text-xs text-on-surface-variant">No data available</span>
    </div>
  );
}
