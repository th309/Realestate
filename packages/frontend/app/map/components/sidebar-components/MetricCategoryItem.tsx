'use client';

import { ChevronDownIcon } from '../Icons';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, MetricCategory } from '../../types';
import { MetricItem } from './MetricItem';

interface MetricCategoryItemProps {
  category: MetricCategory;
  isExpanded: boolean;
  selectedMetric: string;
  geoLevel: GeoLevel;
  forecastHorizon: ForecastHorizon;
  rentIndexType: RentIndexType;
  renterDemandType: RenterDemandType;
  onToggle: () => void;
  onSelectMetric: (id: string) => void;
  onGeoLevelChange: (level: GeoLevel) => void;
  onForecastHorizonChange: (horizon: ForecastHorizon) => void;
  onRentIndexTypeChange: (type: RentIndexType) => void;
  onRenterDemandTypeChange: (type: RenterDemandType) => void;
}

export function MetricCategoryItem({
  category,
  isExpanded,
  selectedMetric,
  geoLevel,
  forecastHorizon,
  rentIndexType,
  renterDemandType,
  onToggle,
  onSelectMetric,
  onGeoLevelChange,
  onForecastHorizonChange,
  onRentIndexTypeChange,
  onRenterDemandTypeChange,
}: MetricCategoryItemProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-600 flex-shrink-0">{category.icon}</span>
          <span className="font-medium text-xs text-gray-800 truncate">{category.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {category.isNew && <span className="text-[10px] text-rose-500 font-medium">New</span>}
          <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
          </span>
        </div>
      </button>

      {isExpanded && category.metrics && (
        <div className="ml-6 mt-1 mb-2 space-y-0.5">
          {category.metrics.map((metric) => (
            <MetricItem
              key={metric.id}
              metric={metric}
              isSelected={selectedMetric === metric.id}
              geoLevel={geoLevel}
              forecastHorizon={forecastHorizon}
              rentIndexType={rentIndexType}
              renterDemandType={renterDemandType}
              onSelect={() => {
                onSelectMetric(metric.id);
                if (metric.id === 'home_price_forecast' && !['metro', 'zip'].includes(geoLevel)) {
                  onGeoLevelChange('metro');
                }
              }}
              onForecastHorizonChange={onForecastHorizonChange}
              onRentIndexTypeChange={onRentIndexTypeChange}
              onRenterDemandTypeChange={onRenterDemandTypeChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
