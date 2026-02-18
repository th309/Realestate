'use client';

import React, { useEffect } from 'react';
import { Lock, MapPin, TrendingUp, BarChart3 } from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import { trackEvent } from '@/lib/analytics/tracker';
import Link from 'next/link';

interface GeoLockCardProps {
  geoName: string;
  geoLevel: 'county' | 'zip' | 'tract';
  parentGeoName?: string;
  features?: string[];
  className?: string;
}

const DEFAULT_FEATURES: Record<string, string[]> = {
  county: [
    'All 60+ metrics at county level',
    'County scores and component breakdown',
    'Historical trends and comparisons',
  ],
  zip: [
    'Neighborhood-level data for every ZIP code',
    'ZIP scores and component breakdown',
    'Hyperlocal trend analysis',
  ],
  tract: [
    'Census tract level granularity',
    'Block-level demographic data',
    'Micro-market analysis',
  ],
};

const GEO_LABELS: Record<string, string> = {
  county: 'County',
  zip: 'ZIP Code',
  tract: 'Census Tract',
};

export function GeoLockCard({
  geoName,
  geoLevel,
  parentGeoName,
  features,
  className = '',
}: GeoLockCardProps) {
  const { trackPaywallView, trackUpgradeClick } = useEntitlements();
  const featureList = features || DEFAULT_FEATURES[geoLevel] || DEFAULT_FEATURES.county;

  useEffect(() => {
    trackPaywallView('geo', geoLevel);
    trackEvent('paywall.view', { geoLevel });
  }, [geoLevel, trackPaywallView]);

  return (
    <div
      className={`
        bg-surface-container rounded-xl p-6 border border-outline-variant
        flex flex-col items-center text-center gap-4
        ${className}
      `}
    >
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="w-7 h-7 text-primary" />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-on-surface">
          {GEO_LABELS[geoLevel]} Data Requires Pro
        </h3>
        <p className="text-sm text-on-surface-variant mt-1">
          {parentGeoName
            ? `Viewing ${geoName} in ${parentGeoName}`
            : `Viewing ${geoName}`}
        </p>
      </div>

      <ul className="text-sm text-on-surface-variant space-y-2 text-left w-full max-w-xs">
        {featureList.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/pricing"
        onClick={() => trackUpgradeClick('geo', geoLevel)}
        className="
          inline-flex items-center gap-2 px-6 py-2.5
          bg-primary text-on-primary rounded-full
          font-medium text-sm
          hover:bg-primary/90 transition-colors
        "
      >
        Unlock {GEO_LABELS[geoLevel]} Data →
      </Link>
    </div>
  );
}
