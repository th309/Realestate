'use client';

import type { GeoLevel } from '../../types';
import { useMarketFactorsData } from '../../hooks/useMarketFactorsData';

interface MarketSnapshotProps {
  geoLevel: GeoLevel;
  geographyId: string | null;
  isOpen: boolean;
}

const SNAPSHOT_METRICS = ['home_value', 'days_on_market', 'for_sale_inventory', 'home_sales'];

const SNAPSHOT_LABELS: Record<string, string> = {
  home_value: 'Median Home Value',
  days_on_market: 'Days on Market',
  for_sale_inventory: 'Active Listings',
  home_sales: 'Home Sales',
};

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
                {SNAPSHOT_LABELS[metricId]}
              </p>
              <p className="text-lg font-bold text-on-surface mt-1">
                {loading ? '...' : (datum?.formattedValue ?? '--')}
              </p>
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
