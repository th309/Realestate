'use client';

import type { GeoLevel } from '../../types';

interface DataSummaryProps {
  recordCount: number;
  geoLevel: GeoLevel;
  selectedState: string;
}

export function DataSummary({ recordCount, geoLevel, selectedState }: DataSummaryProps) {
  const areaLabel = geoLevel === 'state' ? 'states'
    : geoLevel === 'metro' ? 'metros'
    : geoLevel === 'county' ? 'counties'
    : geoLevel === 'zip' ? 'ZIP codes'
    : 'areas';

  return (
    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-600">
        Showing <span className="font-medium text-gray-900">{recordCount.toLocaleString()}</span> {areaLabel}
      </div>
      {geoLevel === 'county' && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
          ~58% of US counties have Zillow home value data. Rural counties with limited housing transactions may show "No data."
        </div>
      )}
      {geoLevel === 'zip' && !selectedState && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-amber-600">
          Select a state to view ZIP code data
        </div>
      )}
    </div>
  );
}
