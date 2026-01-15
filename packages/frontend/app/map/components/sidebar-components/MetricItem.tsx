'use client';

import { useState, useRef, useEffect } from 'react';
import { PremiumIcon, InfoSmallIcon } from '../Icons';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType } from '../../types';
import { ForecastHorizonSelector } from './ForecastHorizonSelector';
import { PropertyTypeSelector } from './PropertyTypeSelector';
import { getMetricDefinition } from '../../data/metricDefinitions';

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
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setShowInfo(false);
      }
    }

    if (showInfo) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showInfo]);

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfo(!showInfo);
  };

  const metricDef = getMetricDefinition(metric.id);

  return (
    <div className="relative">
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
          <span
            onClick={handleInfoClick}
            className="cursor-pointer hover:text-purple-600 transition-colors"
          >
            <InfoSmallIcon />
          </span>
        </span>
      </button>

      {/* Metric Info Popup - positioned to the right of the info icon */}
      {showInfo && metricDef && (
        <div
          ref={infoRef}
          className="absolute left-full top-0 ml-2 z-50 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-xs"
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-gray-900">{metricDef.name}</h4>
            <button
              onClick={() => setShowInfo(false)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              &times;
            </button>
          </div>

          <p className="text-gray-600 mb-3">{metricDef.description}</p>

          {metricDef.formula && (
            <div className="mb-2">
              <span className="font-medium text-gray-700">Formula: </span>
              <span className="text-gray-600 font-mono text-[11px] bg-gray-50 px-1 py-0.5 rounded">
                {metricDef.formula}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 border-t border-gray-100 pt-2 mt-2">
            <span><span className="font-medium">Source:</span> {metricDef.dataSource}</span>
            <span><span className="font-medium">Updates:</span> {metricDef.updateFrequency}</span>
          </div>

          {metricDef.notes && (
            <p className="text-[11px] text-gray-400 italic mt-2">{metricDef.notes}</p>
          )}
        </div>
      )}

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
