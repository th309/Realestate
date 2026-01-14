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

export function Legend({
  selectedMetric,
  forecastHorizon,
  geoLevel,
  homeValues,
}: LegendProps) {
  const isForecast = selectedMetric === 'home_price_forecast';
  const isRentIndex = selectedMetric === 'rent_index';
  const isRenterDemand = selectedMetric === 'rent_for_houses';
  const isInventory = selectedMetric === 'for_sale_inventory';

  // Determine legend title
  let legendTitle = 'Home Value';
  if (isForecast) {
    legendTitle = forecastHorizon === '1m' ? '1-Month Forecast'
      : forecastHorizon === '3m' ? '3-Month Forecast'
        : '12-Month Forecast';
  } else if (isRentIndex) {
    legendTitle = 'Rent Index';
  } else if (isRenterDemand) {
    legendTitle = 'Renter Demand Index';
  } else if (selectedMetric === 'for_sale_inventory') {
    legendTitle = 'Inventory';
  }

  // Forecast legend
  if (isForecast) {
    return (
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-white rounded-lg md:rounded-xl shadow-lg p-2.5 md:p-4 z-10 max-w-[calc(100%-70px)] md:max-w-none">
        <div className="text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">{legendTitle}</div>
        <div className="flex items-center gap-0.5 md:gap-1">
          {COLOR_SCALE.slice(0, 6).map((color, i) => (
            <div key={i} className="w-4 md:w-6 h-3 md:h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-gray-500 mt-1">
          <span>-5%</span>
          <span>+10%</span>
        </div>
        {(geoLevel === 'state' || geoLevel === 'national' || geoLevel === 'county') && (
          <div className="mt-1.5 md:mt-2 pt-1.5 md:pt-2 border-t border-gray-100 text-[10px] md:text-xs text-amber-600">
            Forecast data available for Metro and ZIP levels
          </div>
        )}
        <NoDataIndicator />
      </div>
    );
  }

  // Renter Demand (ZORDI) legend
  if (isRenterDemand) {
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
          <span className="font-medium">100</span>
          <span>200+</span>
        </div>
        <div className="mt-1.5 md:mt-2 pt-1.5 md:pt-2 border-t border-gray-100 text-[10px] md:text-xs text-gray-500">
          100 = baseline · &gt;100 = higher demand
        </div>
        <NoDataIndicator />
      </div>
    );
  }

  // Inventory legend (count-based, 0 to max)
  if (isInventory) {
    const values = Object.values(homeValues)
      .filter((v): v is number => typeof v === 'number' && v >= 0)
      .sort((a, b) => a - b);

    let maxLabel = '10,000+';
    if (values.length > 0) {
      const p95Index = Math.min(Math.floor(values.length * 0.95), values.length - 1);
      const maxVal = values[p95Index];
      maxLabel = maxVal.toLocaleString('en-US') + '+';
    }

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

  // Dynamic range for currency metrics
  let minLabel = '$100K';
  let maxLabel = '$800K+';

  if (isRentIndex) {
    const values = Object.values(homeValues)
      .filter((v): v is number => typeof v === 'number' && v > 0)
      .sort((a, b) => a - b);

    if (values.length > 0) {
      const minVal = values[0];
      const p95Index = Math.min(Math.floor(values.length * 0.95), values.length - 1);
      const maxVal = values[p95Index];

      const formatMoney = (val: number) => {
        return val.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        });
      };
      minLabel = formatMoney(minVal);
      maxLabel = formatMoney(maxVal) + '+';
    } else {
      minLabel = '$0';
      maxLabel = 'N/A';
    }
  }

  // Default home value legend
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
