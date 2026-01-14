'use client';

import type { GeoLevel, ForecastHorizon, HomeValues } from '../types';

interface LegendProps {
  selectedMetric: string;
  forecastHorizon: ForecastHorizon;
  geoLevel: GeoLevel;
  homeValues: HomeValues;
}

const COLOR_SCALE = [
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Green
  '#fbbf24', // Yellow
  '#f97316', // Orange
  '#ef4444', // Red
  '#b91c1c', // Dark red
];

// Display format types for metrics (must match useMapLayers.ts)
type MetricFormat = 'currency' | 'percent' | 'number' | 'index' | 'days';

// Map metric IDs to their display format
function getMetricFormat(metricId: string): MetricFormat {
  const percentMetrics = [
    'home_price_forecast', 'home_value_yoy', 'home_value_mom', 'home_value_5yr',
    'sfh_value_yoy', 'condo_value_yoy', 'inventory_yoy', 'sales_yoy',
    'rent_growth', 'population_growth', 'income_growth', 'job_growth', 'gdp_growth',
    'overvalued_pct', 'price_cut_pct', 'sale_to_list', 'vacancy_rate',
    'homeowner_affordability', 'renter_affordability', 'homeownership_rate',
    'cap_rate', 'gross_yield', 'rent_to_price',
  ];
  const numberMetrics = [
    'for_sale_inventory', 'new_listings', 'pending_listings', 'home_sales',
    'new_construction_sales', 'population', 'median_age',
    'long_term_growth', 'market_health', 'investment_score',
  ];
  const daysMetrics = ['days_on_market', 'days_to_close'];
  const indexMetrics = ['rent_for_houses', 'cost_of_living'];

  if (percentMetrics.includes(metricId)) return 'percent';
  if (numberMetrics.includes(metricId)) return 'number';
  if (daysMetrics.includes(metricId)) return 'days';
  if (indexMetrics.includes(metricId)) return 'index';
  return 'currency';
}

// Map metric IDs to display names
function getMetricTitle(metricId: string, forecastHorizon?: ForecastHorizon): string {
  const titles: Record<string, string> = {
    'home_value': 'Home Value',
    'home_price_forecast': forecastHorizon === '1m' ? '1-Month Forecast'
      : forecastHorizon === '3m' ? '3-Month Forecast' : '12-Month Forecast',
    'home_value_yoy': 'Home Value YoY',
    'home_value_mom': 'Home Value MoM',
    'home_value_5yr': '5-Year Growth (CAGR)',
    'rent_index': 'Rent Index',
    'rent_for_houses': 'Renter Demand Index',
    'for_sale_inventory': 'Inventory',
    'days_on_market': 'Days on Market',
    'days_to_close': 'Days to Close',
    'overvalued_pct': 'Overvalued %',
    'price_cut_pct': 'Price Cut %',
    'new_listings': 'New Listings',
    'pending_listings': 'Pending Listings',
    'population': 'Population',
    'median_income': 'Median Income',
  };
  return titles[metricId] || metricId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

  // Calculate dynamic range from data
  // For percent metrics, include negative values; for others, only positive
  const allValues = Object.values(homeValues).filter((v): v is number => typeof v === 'number' && !isNaN(v));

  const getRange = () => {
    if (allValues.length === 0) {
      // Default ranges based on metric type
      if (metricFormat === 'percent') return { min: -5, max: 10 };
      if (metricFormat === 'days') return { min: 0, max: 90 };
      if (metricFormat === 'number') return { min: 0, max: 10000 };
      if (metricFormat === 'index') return { min: 0, max: 200 };
      return { min: 100000, max: 800000 }; // currency
    }

    const sorted = [...allValues].sort((a, b) => a - b);

    if (metricFormat === 'percent') {
      // For growth metrics, use 5th and 95th percentile to exclude outliers
      const p5Index = Math.max(0, Math.floor(sorted.length * 0.05));
      const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      return { min: sorted[p5Index], max: sorted[p95Index] };
    } else {
      // For non-percent metrics, use min and 95th percentile
      const positiveValues = sorted.filter(v => v >= 0);
      if (positiveValues.length === 0) return { min: 0, max: 100 };
      const p95Index = Math.min(positiveValues.length - 1, Math.floor(positiveValues.length * 0.95));
      return { min: positiveValues[0], max: positiveValues[p95Index] };
    }
  };

  const { min, max } = getRange();

  // Format labels based on metric format
  const formatLabel = (val: number, position: 'min' | 'max'): string => {
    const suffix = position === 'max' ? '+' : '';
    switch (metricFormat) {
      case 'percent':
        // For percent, show sign and round to 1 decimal for precision
        const sign = val > 0 ? '+' : '';
        return sign + val.toFixed(1) + '%';
      case 'number':
        return val.toLocaleString('en-US') + suffix;
      case 'days':
        return val.toLocaleString('en-US') + ' days';
      case 'index':
        return val.toFixed(0) + suffix;
      case 'currency':
      default:
        if (val >= 1000000) {
          return '$' + (val / 1000000).toFixed(1) + 'M' + suffix;
        } else if (val >= 1000) {
          return '$' + Math.round(val / 1000) + 'K' + suffix;
        }
        return '$' + val.toLocaleString('en-US') + suffix;
    }
  };

  // Percent legend (forecasts, growth rates)
  if (metricFormat === 'percent') {
    const minLabel = allValues.length > 0 ? formatLabel(min, 'min') : '-5.0%';
    const maxLabel = allValues.length > 0 ? formatLabel(max, 'max') : '+10.0%';
    return (
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-white rounded-lg md:rounded-xl shadow-lg p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">{legendTitle}</div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.slice(0, 6).map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-gray-500 mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        {isForecast && (geoLevel === 'state' || geoLevel === 'national' || geoLevel === 'county') && (
          <div className="mt-1.5 md:mt-2 pt-1.5 md:pt-2 border-t border-gray-100 text-[10px] md:text-xs text-amber-600">
            Forecast data available for Metro and ZIP levels
          </div>
        )}
        <NoDataIndicator />
      </div>
    );
  }

  // Index legend (renter demand, cost of living)
  if (metricFormat === 'index') {
    const minLabel = allValues.length > 0 ? formatLabel(min, 'min') : '0';
    const maxLabel = allValues.length > 0 ? formatLabel(max, 'max') : '200+';
    return (
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-white rounded-lg md:rounded-xl shadow-lg p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">{legendTitle}</div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-gray-500 mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator />
      </div>
    );
  }

  // Number legend (inventory, listings, population)
  if (metricFormat === 'number') {
    const maxLabel = allValues.length > 0 ? formatLabel(max, 'max') : '10,000+';
    return (
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-white rounded-lg md:rounded-xl shadow-lg p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">{legendTitle}</div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-gray-500 mt-1">
          <span>0</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator />
      </div>
    );
  }

  // Days legend (days on market, days to close)
  if (metricFormat === 'days') {
    const minLabel = allValues.length > 0 ? formatLabel(min, 'min') : '0 days';
    const maxLabel = allValues.length > 0 ? formatLabel(max, 'max') : '90+ days';
    return (
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-white rounded-lg md:rounded-xl shadow-lg p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">{legendTitle}</div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-gray-500 mt-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <NoDataIndicator />
      </div>
    );
  }

  // Currency legend (home values, prices, rent, income) - default
  const minLabel = allValues.length > 0 ? formatLabel(min, 'min') : '$100K';
  const maxLabel = allValues.length > 0 ? formatLabel(max, 'max') : '$800K+';

  return (
    <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-white rounded-lg md:rounded-xl shadow-lg p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
      <div className="text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">{legendTitle}</div>
      <div className="flex items-center gap-0.5 md:gap-1">
        {COLOR_SCALE.map((color, i) => (
          <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] md:text-xs text-gray-500 mt-1">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <NoDataIndicator />
    </div>
  );
}

function NoDataIndicator() {
  return (
    <div className="flex items-center gap-1.5 md:gap-2 mt-2 md:mt-3 pt-2 md:pt-3 border-t border-gray-100">
      <div className="w-4 md:w-6 h-3 md:h-4 rounded border border-gray-300" style={{ backgroundColor: 'rgba(200, 200, 200, 0.5)' }} />
      <span className="text-[10px] md:text-xs text-gray-500">No data available</span>
    </div>
  );
}
