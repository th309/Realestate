'use client';

import type { GeoLevel, ForecastHorizon, MapData } from '../types';
import {
  COLOR_SCALE,
  getMetricFormat,
  calculateValueRange,
  formatValue,
} from '../utils';
import { getMetricDataDate, formatDataDateForDisplay } from '../config';
import { MetricTitle } from '@/app/components/MetricTitle';

interface LegendProps {
  selectedMetric: string;
  forecastHorizon: ForecastHorizon;
  geoLevel: GeoLevel;
  mapData: MapData;
}

export function Legend({
  selectedMetric,
  forecastHorizon,
  geoLevel,
  mapData,
}: LegendProps) {
  const metricFormat = getMetricFormat(selectedMetric);

  // Use shared range calculation - ensures consistency with map layer colors
  // Pass selectedMetric and geoLevel (e.g., permits 0–200+ scale only at county)
  const { min, max, maxLabelSuffix } = calculateValueRange(mapData, metricFormat, selectedMetric, geoLevel);

  // Use shared formatValue for labels - ensures consistency with map (no "100+" for PropertyIQ 0–100 scores)
  const minLabel = formatValue(min, metricFormat, 'min', selectedMetric);
  const maxLabel = formatValue(max, metricFormat, 'max', selectedMetric) + (maxLabelSuffix ?? '');

  // Get "as of" date from central config
  const dataDate = formatDataDateForDisplay(getMetricDataDate(selectedMetric));

  // Check if single value (e.g., national level with only 1 data point)
  const isSingleValue = min === max || Math.abs(max - min) < 0.001;

  // Single value legend - show one color with the value
  if (isSingleValue) {
    const singleValueLabel = formatValue(min, metricFormat, 'min', selectedMetric);
    return (
      <div className="absolute bottom-16 left-3 md:bottom-20 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2"><MetricTitle metricId={selectedMetric} /></div>
        <div className="flex items-center gap-2">
          <div className="w-6 md:w-8 h-4 md:h-5 rounded" style={{ backgroundColor: COLOR_SCALE[3] }} />
          <span className="text-xs md:text-sm text-on-surface-variant">{singleValueLabel}</span>
        </div>
        <NoDataIndicator dataDate={dataDate} />
      </div>
    );
  }

  // Percent legend (forecasts, growth rates)
  if (metricFormat === 'percent') {
    return (
      <div className="absolute bottom-16 left-3 md:bottom-20 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2"><MetricTitle metricId={selectedMetric} /></div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator dataDate={dataDate} />
      </div>
    );
  }

  // Absolute percent legend (affordability, rates - 0-100%)
  if (metricFormat === 'percent_abs') {
    return (
      <div className="absolute bottom-16 left-3 md:bottom-20 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2"><MetricTitle metricId={selectedMetric} /></div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator dataDate={dataDate} />
      </div>
    );
  }

  // Index legend (renter demand, cost of living)
  if (metricFormat === 'index') {
    return (
      <div className="absolute bottom-16 left-3 md:bottom-20 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2"><MetricTitle metricId={selectedMetric} /></div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator dataDate={dataDate} />
      </div>
    );
  }

  // Number legend (inventory, listings, population)
  if (metricFormat === 'number') {
    return (
      <div className="absolute bottom-16 left-3 md:bottom-20 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2"><MetricTitle metricId={selectedMetric} /></div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator dataDate={dataDate} />
      </div>
    );
  }

  // Days legend (days on market, days to close)
  if (metricFormat === 'days') {
    return (
      <div className="absolute bottom-16 left-3 md:bottom-20 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2"><MetricTitle metricId={selectedMetric} /></div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator dataDate={dataDate} />
      </div>
    );
  }

  // Currency legend (home values, prices, rent, income) - default

  return (
    <div className="absolute bottom-16 left-3 md:bottom-20 md:left-6 bg-surface-container-low rounded-xl elevation-1 p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
      <div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2"><MetricTitle metricId={selectedMetric} /></div>
      <div className="flex items-center gap-0.5 md:gap-1">
        {COLOR_SCALE.map((color, i) => (
          <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] md:text-xs text-on-surface-variant mt-1">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <NoDataIndicator dataDate={dataDate} />
    </div>
  );
}

function NoDataIndicator({ dataDate }: { dataDate: string }) {
  return (
    <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-outline-variant">
      <div className="flex items-center gap-1.5 md:gap-2">
        <div className="w-4 md:w-6 h-3 md:h-4 rounded border border-outline" style={{ backgroundColor: 'rgba(200, 200, 200, 0.5)' }} />
        <span className="text-[10px] md:text-xs text-on-surface-variant">No data available</span>
      </div>
      <div className="text-[9px] md:text-[10px] text-outline mt-1.5">as of {dataDate}</div>
    </div>
  );
}
