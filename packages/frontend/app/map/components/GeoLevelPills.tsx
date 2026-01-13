'use client';

import type { GeoLevel } from '../types';
import { US_STATES } from '../types';

interface GeoLevelPillsProps {
  geoLevel: GeoLevel;
  selectedMetric: string;
  selectedState: string;
  onGeoLevelChange: (level: GeoLevel) => void;
  onStateChange: (state: string) => void;
}

export function GeoLevelPills({
  geoLevel,
  selectedMetric,
  selectedState,
  onGeoLevelChange,
  onStateChange,
}: GeoLevelPillsProps) {
  const isForecastMode = selectedMetric === 'home_price_forecast';
  const isRentIndexMode = selectedMetric === 'rent_index';
  const isRenterDemandMode = selectedMetric === 'rent_for_houses';

  const levels = ['National', 'State', 'Metro', 'County', 'City', 'Zip'] as const;

  return (
    <div className="flex gap-2 items-center">
      {levels.map((level) => {
        const levelKey = level.toLowerCase() as GeoLevel;
        const isActive = geoLevel === levelKey;

        // Determine if this level is disabled based on selected metric
        // City is only available for home value metrics (not forecast, rent, etc.)
        const isCityDisabled = levelKey === 'city' && (isForecastMode || isRentIndexMode || isRenterDemandMode);
        const isForecastDisabled = isForecastMode && !['metro', 'zip'].includes(levelKey);
        const isRentIndexDisabled = isRentIndexMode && ['national', 'state'].includes(levelKey);
        const isRenterDemandDisabled = isRenterDemandMode && levelKey !== 'metro';
        const isDisabled = isCityDisabled || isForecastDisabled || isRentIndexDisabled || isRenterDemandDisabled;

        return (
          <button
            key={level}
            onClick={() => !isDisabled && onGeoLevelChange(levelKey)}
            disabled={isDisabled}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all
              ${isActive
                ? 'bg-purple-600 text-white shadow-md'
                : isDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
