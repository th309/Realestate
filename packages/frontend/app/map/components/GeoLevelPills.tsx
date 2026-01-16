'use client';

import type { GeoLevel } from '../types';
import { US_STATES } from '../types';
import { isMetricSupportedForGeo } from '../config';

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
  const levels = ['National', 'State', 'Metro', 'County', 'City', 'Zip'] as const;

  return (
    <div className={`flex gap-2 ${isMobile ? 'flex-wrap' : 'items-center'}`}>
      {levels.map((level) => {
        const levelKey = level.toLowerCase() as GeoLevel;
        const isActive = geoLevel === levelKey;

        // Use central config to determine if metric supports this geography level
        const isDisabled = !isMetricSupportedForGeo(selectedMetric, levelKey);

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
