'use client';

import type { GeoLevel } from '../../types';
import { useMarketFactorsData } from '../../hooks/useMarketFactorsData';
import { MetricTitle } from '@/app/components/MetricTitle';
import { InheritedBadge } from '@/app/components/scoring/InheritedBadge';

interface MarketSnapshotProps {
  geoLevel: GeoLevel;
  geographyId: string | null;
  isOpen: boolean;
}

const SNAPSHOT_METRICS = ['home_value', 'days_on_market', 'for_sale_inventory', 'home_sales'];

export function MarketSnapshot({ geoLevel, geographyId, isOpen }: MarketSnapshotProps) {
  const { data, loading } = useMarketFactorsData(
    SNAPSHOT_METRICS,
    geoLevel,
    geographyId,
    { months: 3, enabled: isOpen && !!geographyId },
  );

  return (
    <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant">
      <h4 className="text-sm font-bold text-on-surface mb-3">Market Snapshot</h4>
      <div className="grid grid-cols-2 gap-3">
        {SNAPSHOT_METRICS.map((metricId) => {
          const datum = data[metricId];
          return (
            <div
              key={metricId}
              className="bg-surface rounded-xl p-3 border border-outline-variant"
            >
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide font-medium">
                <MetricTitle
                  metricId={metricId}
                  resolvedMetric={{
                    source: datum?.source ?? null,
                    sourceGeoLevel: datum?.sourceGeoLevel ?? null,
                    sourceGeoId: datum?.sourceGeoId ?? null,
                    isInherited: datum?.isInherited ?? false,
                    isFallback: datum?.isFallback ?? false,
                  }}
                />
              </p>
              <p className="text-lg font-bold text-on-surface mt-1">
                {loading ? '...' : (datum?.formattedValue ?? '--')}
              </p>
              {(datum?.isFallback || (datum?.isInherited && datum?.sourceGeoLevel && ['county', 'metro', 'state', 'national'].includes(datum.sourceGeoLevel))) && (
                <div className="flex items-center gap-1 mt-1">
                  {datum?.isFallback && (
                    <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[8px] font-medium text-amber-700">
                      Fallback
                    </span>
                  )}
                  {datum?.isInherited && datum?.sourceGeoLevel && ['county', 'metro', 'state', 'national'].includes(datum.sourceGeoLevel) && (
                    <InheritedBadge sourceType={datum.sourceGeoLevel as 'county' | 'metro' | 'state' | 'national'} />
                  )}
                </div>
              )}
              {datum?.trendPercent != null && (
                <span
                  className={`text-[10px] font-medium ${
                    datum.trendPercent >= 0 ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {datum.trendPercent >= 0 ? '+' : ''}
                  {datum.trendPercent.toFixed(1)}% vs 3mo ago
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
