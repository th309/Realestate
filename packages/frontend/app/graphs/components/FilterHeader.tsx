'use client';

import React, { useState } from 'react';
import { MapPin, BarChart2, Globe } from 'lucide-react';
import { ComparisonConfig, MetricOption } from '../types';
import { GeoLevel } from '@/app/map/config/metrics';
import { GEO_LEVEL_OPTIONS, BASELINE_GEO_LEVELS } from '../hooks/useDashboardState';
import { M3Select } from './M3Select';
import { M3Card, M3CardHeader } from './M3Card';
import { SearchBar } from '@/app/map/components';
import { useGraphSearch } from '../hooks/useGraphSearch';
import { SearchResult } from '@/app/map/types';
import { MetricSelector } from '@/app/map/components/MetricSelector';

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
  selectedAreaId: string;
  setSelectedAreaId: (id: string) => void;
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
  selectedAreaId,
  setSelectedAreaId,
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
  const [showMetricSelector, setShowMetricSelector] = useState(false);

  // Primary area search - pass geoLevel for optimized metro search
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    searchRef,
    handleSearch,
    clearSearch
  } = useGraphSearch(geoLevel);

  // Compare-to search: same behavior as primary when geo is metro/county/city/zip
  const {
    searchQuery: comparisonSearchQuery,
    setSearchQuery: setComparisonSearchQuery,
    searchResults: comparisonSearchResults,
    searchLoading: comparisonSearchLoading,
    showSearchResults: showComparisonSearchResults,
    setShowSearchResults: setShowComparisonSearchResults,
    searchRef: comparisonSearchRef,
    handleSearch: handleComparisonSearch,
    clearSearch: clearComparisonSearch
  } = useGraphSearch(geoLevel);

  const handleSelectResult = (result: SearchResult) => {
    setSelectedArea(result.name);
    setSelectedAreaId(result.value || result.name);
    clearSearch();
  };

  const handleSelectComparisonResult = (result: SearchResult) => {
    setComparison((prev) => ({
      ...prev,
      area: result.name,
      areaId: result.value || result.name,
    }));
    clearComparisonSearch();
  };

  const showSearch = ['metro', 'county', 'city', 'zip'].includes(geoLevel);

  // Get placeholder text based on geo level
  const getSearchPlaceholder = () => {
    switch (geoLevel) {
      case 'metro': return 'Search metros (e.g., Chicago, Miami)';
      case 'county': return 'Search counties (e.g., Cook, Harris)';
      case 'city': return 'Search cities (e.g., Austin, Denver)';
      case 'zip': return 'Search ZIP codes (e.g., 90210, 33139)';
      default: return 'Search location';
    }
  };

  // Show selected area in input when not actively searching (primary and compare mirror each other)
  const displayValue = showSearchResults ? searchQuery : (searchQuery || selectedArea);
  const comparisonDisplayValue = showComparisonSearchResults ? comparisonSearchQuery : (comparisonSearchQuery || comparison.area);

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
          {showSearch ? (
            <div className="w-full -ml-0 md:-ml-0">
              {/* SearchBar has built-in margins that might interfere, wrapping to control context if needed. 
                   Checking SearchBar implementation: className="flex-1 max-w-2xl mx-0 md:mx-8"
                   This margin might slide it to the right. We might need to override it via a prop if we could, 
                   but we strictly can't change SearchBar props easily without editing it. 
                   However, passing a style or class isn't part of SearchBarProps. 
                   Wait, SearchBar is fairly rigid. 
                   Let's assume it renders okay or I will fix SearchBar in next step if it looks bad.
               */}
              <div className="relative">
                {/* We render a custom wrapper to override the SearchBar's internal margin effect if possible, 
                      or just let it be. Actually, `mx-0 md:mx-8` means on desktop it has 2rem margin. 
                      In a card, that's too much. 
                      I should probably edit SearchBar to accept className prop for flexibility.
                      But for now, I will use it as is.
                  */}
                <SearchBar
                  className="w-full"
                  searchRef={searchRef}
                  searchQuery={displayValue}
                  searchResults={searchResults}
                  searchLoading={searchLoading}
                  showSearchResults={showSearchResults}
                  onSearch={handleSearch}
                  onSelectResult={handleSelectResult}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchResults(true);
                    // Clear displayed selectedArea when user focuses to search
                    if (!searchQuery && selectedArea) setSearchQuery('');
                  }}
                  placeholder={getSearchPlaceholder()}
                />
              </div>
            </div>
          ) : (
            <M3Select
              label="Primary Area"
              value={selectedArea || ''}
              onChange={(val) => {
                setSelectedArea(val);
                setSelectedAreaId(val); // For state/national, name = ID
              }}
              options={[
                { value: '', label: geoLevel === 'national' ? 'Select...' : 'Select state...' },
                ...primaryOptions,
              ]}
            />
          )}

          {geoLevel !== 'national' && (
            <div className="flex gap-2">
              <button
                onClick={() => setComparison((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`flex-1 text-[10px] font-medium py-2 px-3 rounded-full border transition-all duration-200 ${comparison.enabled
                  ? 'bg-secondary text-on-secondary border-secondary'
                  : 'bg-surface text-on-surface-variant border-outline-variant hover:border-secondary hover:text-secondary'
                  }`}
              >
                {comparison.enabled ? '✓ Comparing' : '+ Compare'}
              </button>
              <button
                onClick={() => setBaseline((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`flex-1 text-[10px] font-medium py-2 px-3 rounded-full border transition-all duration-200 ${baseline.enabled
                  ? 'bg-tertiary text-on-tertiary border-tertiary'
                  : 'bg-surface text-on-surface-variant border-outline-variant hover:border-tertiary hover:text-tertiary'
                  }`}
              >
                {baseline.enabled ? '✓ Baseline' : '+ Baseline'}
              </button>
            </div>
          )}
          {comparison.enabled && showSearch ? (
            <div className="w-full -ml-0 md:-ml-0">
              <div className="relative">
                <div className="text-xs font-medium text-on-surface-variant mb-1.5">Compare To</div>
                <SearchBar
                  className="w-full"
                  searchRef={comparisonSearchRef}
                  searchQuery={comparisonDisplayValue}
                  searchResults={comparisonSearchResults}
                  searchLoading={comparisonSearchLoading}
                  showSearchResults={showComparisonSearchResults}
                  onSearch={handleComparisonSearch}
                  onSelectResult={handleSelectComparisonResult}
                  onFocus={() => {
                    if (comparisonSearchResults.length > 0) setShowComparisonSearchResults(true);
                    if (!comparisonSearchQuery && comparison.area) setComparisonSearchQuery('');
                  }}
                  placeholder={getSearchPlaceholder()}
                />
              </div>
            </div>
          ) : comparison.enabled ? (
            <M3Select
              label="Compare To"
              value={comparison.area || ''}
              onChange={(val) => setComparison((prev) => ({ ...prev, area: val, areaId: undefined }))}
              options={[
                { value: '', label: 'Select...' },
                ...primaryOptions.filter((s) => s !== selectedArea),
              ]}
            />
          ) : null}
          {baseline.enabled && (
            <div className="flex gap-2">
              <div className="flex-1">
                <M3Select
                  label="Base Level"
                  value={BASELINE_GEO_LEVELS.find((opt) => opt.value === baseline.level)?.label || 'National'}
                  onChange={(val) => {
                    const level = BASELINE_GEO_LEVELS.find((opt) => opt.label === val)?.value || 'national';
                    setBaseline((prev) => ({ ...prev, level }));
                  }}
                  options={BASELINE_GEO_LEVELS.map((opt) => opt.label)}
                />
              </div>
              <div className="flex-1">
                <M3Select
                  label="Base Area"
                  value={baseline.area || ''}
                  onChange={(val) => setBaseline((prev) => ({ ...prev, area: val }))}
                  options={[
                    { value: '', label: baseline.level === 'national' ? 'Select...' : 'Select state...' },
                    ...baselineOptions,
                  ]}
                />
              </div>
            </div>
          )}
        </div>
      </M3Card>

      {/* Metric Selection Card */}
      <M3Card variant="elevated" size="md" className="relative">
        <M3CardHeader
          icon={<BarChart2 className="w-4 h-4 text-primary" />}
          title="Market Metric"
          subtitle="Data point to analyze"
        />
        <div className="mt-4 relative">
          {showMetricSelector ? (
            <MetricSelector
              selectedMetrics={[metric]}
              onSave={(metricIds) => {
                if (metricIds.length > 0) {
                  setMetric(metricIds[0]);
                }
                setShowMetricSelector(false);
              }}
              onCancel={() => setShowMetricSelector(false)}
              maxSelections={1}
              geoLevel={geoLevel}
              className="absolute top-0 left-0 right-0 z-10 max-h-[400px]"
            />
          ) : (
            <button
              onClick={() => setShowMetricSelector(true)}
              className="w-full text-left px-4 py-3 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-between"
            >
              <div>
                <div className="text-xs text-on-surface-variant mb-1">Metric</div>
                <div className="text-sm font-medium text-on-surface">{metricName}</div>
              </div>
              <svg className="w-4 h-4 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </M3Card>
    </div>
  );
};
