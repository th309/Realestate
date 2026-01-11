'use client';

import { PremiumIcon, InfoSmallIcon } from '../Icons';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType } from '../../types';
import { ForecastHorizonSelector } from './ForecastHorizonSelector';
import { PropertyTypeSelector } from './PropertyTypeSelector';

interface MetricItemProps {
  metric: { id: string; name: string; isPremium?: boolean; isNew?: boolean };
  isSelected: boolean;
  geoLevel: GeoLevel;
  forecastHorizon: ForecastHorizon;
  rentIndexType: RentIndexType;
  renterDemandType: RenterDemandType;
  onSelect: () => void;
  onForecastHorizonChange: (horizon: ForecastHorizon) => void;
  onRentIndexTypeChange: (type: RentIndexType) => void;
  onRenterDemandTypeChange: (type: RenterDemandType) => void;
}

export function MetricItem({
  metric,
  isSelected,
  geoLevel,
  forecastHorizon,
  rentIndexType,
  renterDemandType,
  onSelect,
  onForecastHorizonChange,
  onRentIndexTypeChange,
  onRenterDemandTypeChange,
}: MetricItemProps) {
  return (
    <div>
      <button
        onClick={onSelect}
        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${
          isSelected ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="truncate">{metric.name}</span>
          {metric.isNew && <span className="text-[10px] text-rose-500 font-medium flex-shrink-0">New</span>}
        </span>
        <span className="flex items-center gap-0.5 flex-shrink-0 ml-1">
          {metric.isPremium && <PremiumIcon />}
          <InfoSmallIcon />
        </span>
      </button>

      {/* Forecast Horizon Selector */}
      {metric.id === 'home_price_forecast' && isSelected && (
        <ForecastHorizonSelector
          value={forecastHorizon}
          onChange={onForecastHorizonChange}
        />
      )}

      {/* Rent Index Type Selector */}
      {metric.id === 'rent_index' && isSelected && (
        <PropertyTypeSelector
          value={rentIndexType}
          geoLevel={geoLevel}
          colorScheme="purple"
          onChange={onRentIndexTypeChange}
        />
      )}

      {/* Renter Demand Type Selector */}
      {metric.id === 'rent_for_houses' && isSelected && (
        <PropertyTypeSelector
          value={renterDemandType}
          geoLevel={geoLevel}
          colorScheme="green"
          onChange={onRenterDemandTypeChange}
        />
      )}
    </div>
  );
}
