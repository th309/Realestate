'use client';

import type { GeoLevel } from '../../types';
import { useMetricFreshness } from '@/lib/data/hooks';

interface DataSummaryProps {
  recordCount: number;
  geoLevel: GeoLevel;
  selectedState: string;
  selectedMetric: string;
}

export function DataSummary({ recordCount, geoLevel, selectedState, selectedMetric }: DataSummaryProps) {
  const areaLabel = geoLevel === 'state' ? 'states'
    : geoLevel === 'metro' ? 'metros'
    : geoLevel === 'county' ? 'counties'
    : geoLevel === 'zip' ? 'ZIP codes'
    : 'areas';

  const { formattedDate: dataDate } = useMetricFreshness(selectedMetric, geoLevel);

  return (
    <div className="mb-4 p-3 bg-surface-container-low rounded-lg">
      <div className="text-sm text-on-surface-variant">
        Showing <span className="font-medium text-on-surface">{recordCount.toLocaleString()}</span> {areaLabel}
        {dataDate && <span className="text-outline ml-1">· as of {dataDate}</span>}
      </div>
      {geoLevel === 'county' && (
        <div className="mt-2 pt-2 border-t border-outline-variant text-xs text-on-surface-variant">
          ~58% of US counties have Zillow home value data. Rural counties with limited housing transactions may show "No data."
        </div>
      )}
      {geoLevel === 'zip' && !selectedState && (
        <div className="mt-2 pt-2 border-t border-outline-variant text-xs text-amber-600">
          Select a state to view ZIP code data
        </div>
      )}
    </div>
  );
}
