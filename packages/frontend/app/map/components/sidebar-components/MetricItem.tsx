'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PremiumIcon, InfoSmallIcon } from '../Icons';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType } from '../../types';
import { ForecastHorizonSelector } from './ForecastHorizonSelector';
import { PropertyTypeSelector } from './PropertyTypeSelector';
import { getMetricDefinition } from '../../data/metricDefinitions';
import { getMetricDataDate, formatDataDateForDisplay } from '../../config';

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
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const infoRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLSpanElement>(null);

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
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPosition({
        top: rect.top,
        left: rect.right + 8, // 8px gap to the right
      });
    }
    setShowInfo(!showInfo);
  };

  const metricDef = getMetricDefinition(metric.id);

  return (
    <div className="relative">
      <button
        onClick={onSelect}
        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors duration-200 ${isSelected ? 'bg-primary-container text-on-primary-container font-medium' : 'text-on-surface-variant hover:bg-surface-container'
          }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="truncate">{metric.name}</span>
          {metric.isNew && <span className="text-[10px] text-rose-500 font-medium flex-shrink-0">New</span>}
        </span>
        <span className="flex items-center gap-0.5 flex-shrink-0 ml-1">
          {metric.isPremium && <PremiumIcon />}
          <span
            ref={buttonRef}
            onClick={handleInfoClick}
            className="cursor-pointer hover:text-primary transition-colors duration-200"
          >
            <InfoSmallIcon />
          </span>
        </span>
      </button>

      {/* Metric Info Popup - M3 Dialog styling */}
      {showInfo && metricDef && typeof document !== 'undefined' && createPortal(
        <div
          ref={infoRef}
          className="fixed w-72 bg-surface-container-lowest rounded-[28px] elevation-3 border border-outline-variant p-3 text-xs"
          style={{
            top: popupPosition.top,
            left: popupPosition.left,
            zIndex: 99999,
          }}
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-on-surface">{metricDef.name}</h4>
            <button
              onClick={() => setShowInfo(false)}
              className="text-on-surface-variant hover:text-on-surface text-lg leading-none transition-colors duration-200"
            >
              &times;
            </button>
          </div>

          <p className="text-on-surface-variant mb-3">{metricDef.description}</p>

          {metricDef.formula && (
            <div className="mb-2">
              <span className="font-medium text-on-surface">Formula: </span>
              <span className="text-on-surface-variant font-mono text-[11px] bg-surface-container px-1 py-0.5 rounded">
                {metricDef.formula}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant border-t border-outline-variant pt-2 mt-2">
            <span><span className="font-medium">Source:</span> {metricDef.dataSource}</span>
            <span><span className="font-medium">Updates:</span> {metricDef.updateFrequency}</span>
            <span><span className="font-medium">As of:</span> {formatDataDateForDisplay(getMetricDataDate(metric.id))}</span>
          </div>

          {metricDef.notes && (
            <p className="text-[11px] text-on-surface-variant/70 italic mt-2">{metricDef.notes}</p>
          )}
        </div>,
        document.body
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
