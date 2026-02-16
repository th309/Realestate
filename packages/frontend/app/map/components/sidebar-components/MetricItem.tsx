'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LockIcon } from '../Icons';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType } from '../../types';
import { ForecastHorizonSelector } from './ForecastHorizonSelector';
import { PropertyTypeSelector } from './PropertyTypeSelector';
import { MetricTitle } from '@/app/components/MetricTitle';
import { useEntitlements } from '@/lib/entitlements';
import { PaywallCard } from '@/components/entitlements/PaywallCard';

interface MetricItemProps {
  metric: { id: string; name: string; isNew?: boolean };
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
  const { isMetricGated } = useEntitlements();
  const isLocked = isMetricGated(metric.id);
  const [showPaywall, setShowPaywall] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={isLocked ? () => setShowPaywall(true) : onSelect}
        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors duration-200 ${
          isLocked
            ? 'text-on-surface-variant/60 hover:bg-surface-container cursor-pointer'
            : isSelected
              ? 'bg-primary-container text-on-primary-container font-medium'
              : 'text-on-surface-variant hover:bg-surface-container'
          }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <MetricTitle metricId={metric.id} className="truncate" />
        </span>
        {isLocked && (
          <span className="flex items-center flex-shrink-0 ml-1">
            <LockIcon className="w-3.5 h-3.5 text-on-surface-variant/60" />
          </span>
        )}
      </button>

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

      {/* Paywall modal for locked metrics */}
      {showPaywall && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40"
          onClick={() => setShowPaywall(false)}
        >
          <div className="max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <PaywallCard
              type="metric"
              id={metric.id}
              title={`Unlock ${metric.name}`}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
