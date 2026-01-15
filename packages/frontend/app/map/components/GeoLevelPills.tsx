'use client';

import type { GeoLevel } from '../types';
import { US_STATES } from '../types';

// Metrics that have city-level data available (from Zillow ZHVI city data)
// All other metrics do NOT have city data
const CITY_AVAILABLE_METRICS = new Set([
  'home_value',
  'list_price',
]);

// Metrics that are ONLY available at metro level
const METRO_ONLY_METRICS = new Set([
  'income_to_buy',
  'income_to_rent',
  'affordable_home_price',
  'years_to_save',
  'homeowner_affordability',
  'renter_affordability',
  'new_construction_sales',
  'new_construction_price',
  'new_construction_ppsf',
  'sale_price',
  'sale_to_list',
  'home_sales',
  'sales_yoy',
  'days_to_close',
  'market_health',
  'rent_for_houses',
  'overvalued_pct',
  'cap_rate',
  'gross_yield',
]);

interface GeoLevelPillsProps {
  geoLevel: GeoLevel;
  selectedMetric: string;
  selectedState: string;
  onGeoLevelChange: (level: GeoLevel) => void;
  onStateChange: (state: string) => void;
  isMobile?: boolean;
}

export function GeoLevelPills({
  geoLevel,
  selectedMetric,
  selectedState,
  onGeoLevelChange,
  onStateChange,
  isMobile = false,
}: GeoLevelPillsProps) {
  const isForecastMode = selectedMetric === 'home_price_forecast';
  const isRentIndexMode = selectedMetric === 'rent_index';
  const isMetroOnlyMode = METRO_ONLY_METRICS.has(selectedMetric);

  const levels = ['National', 'State', 'Metro', 'County', 'City', 'Zip'] as const;

  return (
    <div className={`flex gap-2 ${isMobile ? 'flex-wrap' : 'items-center'}`}>
      {levels.map((level) => {
        const levelKey = level.toLowerCase() as GeoLevel;
        const isActive = geoLevel === levelKey;

        // Determine if this level is disabled based on selected metric
        // City is only available for home_value and list_price metrics
        const isCityDisabled = levelKey === 'city' && !CITY_AVAILABLE_METRICS.has(selectedMetric);
        const isForecastDisabled = isForecastMode && !['metro', 'zip'].includes(levelKey);
        const isRentIndexDisabled = isRentIndexMode && ['national', 'state'].includes(levelKey);
        const isMetroOnlyDisabled = isMetroOnlyMode && levelKey !== 'metro';
        const isDisabled = isCityDisabled || isForecastDisabled || isRentIndexDisabled || isMetroOnlyDisabled;

        // M3 Filter Chips: rounded-lg, border-outline, bg-surface
        return (
          <button
            key={level}
            onClick={() => !isDisabled && onGeoLevelChange(levelKey)}
            disabled={isDisabled}
            className={`
              ${isMobile ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} rounded-lg font-medium transition-all duration-200
              ${isActive
                ? 'bg-primary text-on-primary elevation-1'
                : isDisabled
                  ? 'bg-surface-container text-on-surface-variant/50 cursor-not-allowed'
                  : 'bg-surface border border-outline text-on-surface-variant hover:bg-surface-container-high'
              }
            `}
            title={isDisabled ? `Not available for ${selectedMetric.replace(/_/g, ' ')}` : undefined}
          >
            {level}
          </button>
        );
      })}

      {/* State selector for state-specific levels (City, ZIP) */}
      {['city', 'zip'].includes(geoLevel) && (
        <select
          value={selectedState}
          onChange={(e) => onStateChange(e.target.value)}
          className={`
            ${isMobile ? 'w-full mt-2 px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}
            rounded-lg border border-outline bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary
          `}
        >
          <option value="">Select State</option>
          {US_STATES.map((state) => (
            <option key={state.abbrev} value={state.abbrev}>
              {state.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
