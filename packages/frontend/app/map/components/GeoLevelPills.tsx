'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock } from 'lucide-react';
import type { GeoLevel } from '../types';
import { US_STATES } from '../types';
import { isMetricSupportedForGeo } from '../config';
import { useEntitlements } from '@/lib/entitlements';
import { PaywallCard } from '@/components/entitlements';

interface GeoLevelPillsProps {
  geoLevel: GeoLevel;
  selectedMetric: string;
  selectedState: string;
  onGeoLevelChange: (level: GeoLevel) => void;
  onStateChange: (state: string) => void;
  isMobile?: boolean;
}

// Map geo levels to entitlement resource IDs
const GEO_ENTITLEMENT_MAP: Record<string, string> = {
  county: 'geo:county',
  zip: 'geo:zip',
  tract: 'geo:tract',
};

// Geo levels that are always free
const FREE_GEO_LEVELS = ['national', 'state', 'metro', 'city'];

export function GeoLevelPills({
  geoLevel,
  selectedMetric,
  selectedState,
  onGeoLevelChange,
  onStateChange,
  isMobile = false,
}: GeoLevelPillsProps) {
  const levels = ['National', 'State', 'Metro', 'County', 'City', 'Zip'] as const;
  const { getAccess, trackPaywallView } = useEntitlements();
  const [showPaywall, setShowPaywall] = useState<string | null>(null);

  // Check if a geo level requires entitlement
  const isGeoGated = (levelKey: string): boolean => {
    return !FREE_GEO_LEVELS.includes(levelKey);
  };

  // Check if user has access to a geo level
  const hasGeoAccess = (levelKey: string): boolean => {
    if (FREE_GEO_LEVELS.includes(levelKey)) return true;
    const entitlementKey = GEO_ENTITLEMENT_MAP[levelKey];
    if (!entitlementKey) return true;
    const access = getAccess('geo', levelKey);
    return access.level === 'full' || access.level === 'preview';
  };

  const handleGeoClick = (levelKey: GeoLevel) => {
    if (!hasGeoAccess(levelKey)) {
      trackPaywallView('geo', levelKey);
      setShowPaywall(levelKey);
      return;
    }
    onGeoLevelChange(levelKey);
  };

  return (
    <div className={`flex gap-2 ${isMobile ? 'flex-wrap' : 'items-center'} relative`}>
      {levels.map((level) => {
        const levelKey = level.toLowerCase() as GeoLevel;
        const isActive = geoLevel === levelKey;

        // Use central config to determine if metric supports this geography level
        const isMetricDisabled = !isMetricSupportedForGeo(selectedMetric, levelKey);
        const isLocked = isGeoGated(levelKey) && !hasGeoAccess(levelKey);

        // M3 Filter Chips: rounded-lg, border-outline, bg-surface
        return (
          <button
            key={level}
            onClick={() => !isMetricDisabled && handleGeoClick(levelKey)}
            disabled={isMetricDisabled}
            className={`
              ${isMobile ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} rounded-lg font-medium transition-all duration-200
              flex items-center gap-1.5
              ${isActive
                ? 'bg-primary text-on-primary elevation-1'
                : isMetricDisabled
                  ? 'bg-surface-container text-on-surface-variant/50 cursor-not-allowed'
                  : isLocked
                    ? 'bg-surface border border-outline text-on-surface-variant hover:bg-surface-container-high'
                    : 'bg-surface border border-outline text-on-surface-variant hover:bg-surface-container-high'
              }
            `}
            title={
              isMetricDisabled
                ? `Not available for ${selectedMetric.replace(/_/g, ' ')}`
                : isLocked
                  ? 'Pro feature - Click to learn more'
                  : undefined
            }
          >
            {level}
            {isLocked && <Lock className="w-3 h-3 text-primary" />}
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

      {/* Paywall Modal */}
      {showPaywall && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-on-surface/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
            <div className="p-1">
              <PaywallCard
                type="geo"
                id={showPaywall}
                title={`Unlock ${showPaywall.charAt(0).toUpperCase() + showPaywall.slice(1)} Level Data`}
                description={`Access granular ${showPaywall}-level market data to make more informed decisions.`}
              />
            </div>
            <div className="px-6 pb-4">
              <button
                onClick={() => setShowPaywall(null)}
                className="w-full py-2 text-sm text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
