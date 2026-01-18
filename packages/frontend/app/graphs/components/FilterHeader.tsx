'use client';

import React from 'react';
import { MapPin, BarChart2, Globe } from 'lucide-react';
import { ComparisonConfig, MetricOption } from '../types';
import { GeoLevel } from '@/app/map/config/metrics';
import { GEO_LEVEL_OPTIONS } from '../hooks/useDashboardState';
import { M3Select } from './M3Select';
import { M3Card, M3CardHeader } from './M3Card';

interface BaselineConfig {
  enabled: boolean;
  level: GeoLevel;
  area: string;
}

interface FilterHeaderProps {
  geoLevel: GeoLevel;
  setGeoLevel: (level: GeoLevel) => void;
  selectedArea: string;
  setSelectedArea: (area: string) => void;
  metric: string;
  setMetric: (metric: string) => void;
  metricOptions: MetricOption[];
  primaryOptions: string[];
  comparison: ComparisonConfig;
  setComparison: React.Dispatch<React.SetStateAction<ComparisonConfig>>;
  baseline: BaselineConfig;
  setBaseline: React.Dispatch<React.SetStateAction<BaselineConfig>>;
  baselineOptions: string[];
  showMilestones: boolean;
  setShowMilestones: (show: boolean) => void;
  showForecast: boolean;
  setShowForecast: (show: boolean) => void;
  visibleSeries: Record<string, boolean>;
  toggleSeries: (key: string) => void;
}

export const FilterHeader: React.FC<FilterHeaderProps> = ({
  geoLevel,
  setGeoLevel,
  selectedArea,
  setSelectedArea,
  metric,
  setMetric,
  metricOptions,
  primaryOptions,
  comparison,
  setComparison,
  baseline,
  setBaseline,
  baselineOptions,
}) => {
  const geoLevelLabel = GEO_LEVEL_OPTIONS.find((opt) => opt.value === geoLevel)?.label || geoLevel;
  const metricName = metricOptions.find((m) => m.id === metric)?.name || metric;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Geography Selection Card */}
      <M3Card variant="elevated" size="md">
        <M3CardHeader
          icon={<Globe className="w-4 h-4 text-primary" />}
          title="Geography Level"
          subtitle="Select analysis scope"
        />
        <div className="mt-4">
          <M3Select
            label="Level"
            value={geoLevelLabel}
            onChange={(val) => {
              const level = GEO_LEVEL_OPTIONS.find((opt) => opt.label === val)?.value || 'state';
              setGeoLevel(level);
            }}
            options={GEO_LEVEL_OPTIONS.map((opt) => opt.label)}
            isPrimary
          />
        </div>
      </M3Card>

      {/* Location Selection Card */}
      <M3Card variant="elevated" size="md">
        <M3CardHeader
          icon={<MapPin className="w-4 h-4 text-primary" />}
          title="Target Location"
          subtitle={geoLevel === 'national' ? 'National view selected' : 'Choose primary area'}
        />
        <div className="mt-4 space-y-3">
          <M3Select
            label="Primary Area"
            value={selectedArea}
            onChange={setSelectedArea}
            options={primaryOptions}
            disabled={geoLevel === 'national'}
          />
          {geoLevel !== 'national' && (
            <div className="flex gap-2">
              <button
                onClick={() => setComparison((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`flex-1 text-[10px] font-medium py-2 px-3 rounded-full border transition-all duration-200 ${
                  comparison.enabled
                    ? 'bg-secondary text-on-secondary border-secondary'
                    : 'bg-surface text-on-surface-variant border-outline-variant hover:border-secondary hover:text-secondary'
                }`}
              >
                {comparison.enabled ? '✓ Comparing' : '+ Compare'}
              </button>
              <button
                onClick={() => setBaseline((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`flex-1 text-[10px] font-medium py-2 px-3 rounded-full border transition-all duration-200 ${
                  baseline.enabled
                    ? 'bg-tertiary text-on-tertiary border-tertiary'
                    : 'bg-surface text-on-surface-variant border-outline-variant hover:border-tertiary hover:text-tertiary'
                }`}
              >
                {baseline.enabled ? '✓ Baseline' : '+ Baseline'}
              </button>
            </div>
          )}
          {comparison.enabled && (
            <M3Select
              label="Compare To"
              value={comparison.area}
              onChange={(val) => setComparison((prev) => ({ ...prev, area: val }))}
              options={primaryOptions.filter((s) => s !== selectedArea)}
            />
          )}
          {baseline.enabled && (
            <div className="flex gap-2">
              <div className="flex-1">
                <M3Select
                  label="Base Level"
                  value={GEO_LEVEL_OPTIONS.find((opt) => opt.value === baseline.level)?.label || 'National'}
                  onChange={(val) => {
                    const level = GEO_LEVEL_OPTIONS.find((opt) => opt.label === val)?.value || 'national';
                    setBaseline((prev) => ({ ...prev, level }));
                  }}
                  options={GEO_LEVEL_OPTIONS.map((opt) => opt.label)}
                />
              </div>
              <div className="flex-1">
                <M3Select
                  label="Base Area"
                  value={baseline.area}
                  onChange={(val) => setBaseline((prev) => ({ ...prev, area: val }))}
                  options={baselineOptions}
                />
              </div>
            </div>
          )}
        </div>
      </M3Card>

      {/* Metric Selection Card */}
      <M3Card variant="elevated" size="md">
        <M3CardHeader
          icon={<BarChart2 className="w-4 h-4 text-primary" />}
          title="Market Metric"
          subtitle="Data point to analyze"
        />
        <div className="mt-4">
          <M3Select
            label="Metric"
            value={metricName}
            onChange={(val) => {
              const metricId = metricOptions.find((m) => m.name === val)?.id || 'listing_price';
              setMetric(metricId);
            }}
            options={metricOptions.map((m) => m.name)}
          />
        </div>
      </M3Card>
    </div>
  );
};
