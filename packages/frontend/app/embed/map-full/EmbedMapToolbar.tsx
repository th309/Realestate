"use client";

import { useAllMetricOptions } from "@/app/map/hooks/useMetricOptions";
import { SearchWidget } from "@/app/map/components/SearchWidget";
import { GeoLevelPills } from "@/app/map/components/GeoLevelPills";
import type { GeoLevel, SearchResult } from "@/app/map/types";
import type { EmbedMapConfig } from "./useEmbedMapConfig";

interface EmbedMapToolbarProps {
  config: EmbedMapConfig;
  geoLevel: GeoLevel;
  selectedMetric: string;
  selectedState: string;
  onMetricChange: (metricId: string) => void;
  onGeoLevelChange: (level: GeoLevel) => void;
  onStateChange: (state: string) => void;
  /** Search props — passed through to SearchWidget */
  searchProps: {
    searchRef: React.RefObject<HTMLDivElement | null>;
    searchQuery: string;
    searchResults: SearchResult[];
    searchLoading: boolean;
    showSearchResults: boolean;
    onSearch: (query: string) => void;
    onSelectResult: (result: SearchResult) => void;
    onFocus: () => void;
  };
}

/**
 * Compact toolbar for the full interactive map embed.
 * Renders metric dropdown, geo pills, and search conditionally based on config flags.
 */
export function EmbedMapToolbar({
  config,
  geoLevel,
  selectedMetric,
  selectedState,
  onMetricChange,
  onGeoLevelChange,
  onStateChange,
  searchProps,
}: EmbedMapToolbarProps) {
  const hasAnyElement =
    config.showMetricPicker || config.showGeoPills || config.showSearch;

  if (!hasAnyElement) return null;

  return (
    <div className="bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant px-3 py-2 z-20 shadow-sm">
      <div className="flex items-center gap-3 flex-wrap">
        {config.showMetricPicker && (
          <MetricDropdown
            geoLevel={geoLevel}
            selectedMetric={selectedMetric}
            onMetricChange={onMetricChange}
          />
        )}

        {config.showGeoPills && (
          <GeoLevelPills
            geoLevel={geoLevel}
            selectedMetric={selectedMetric}
            selectedState={selectedState}
            onGeoLevelChange={onGeoLevelChange}
            onStateChange={onStateChange}
          />
        )}

        {config.showSearch && (
          <div className="flex-1 max-w-sm min-w-[200px]">
            <SearchWidget
              searchRef={searchProps.searchRef}
              searchQuery={searchProps.searchQuery}
              searchResults={searchProps.searchResults}
              searchLoading={searchProps.searchLoading}
              showSearchResults={searchProps.showSearchResults}
              onSearch={searchProps.onSearch}
              onSelectResult={searchProps.onSelectResult}
              onFocus={searchProps.onFocus}
              showFavorites={false}
              placeholder="Search location..."
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact metric dropdown using the data-binding hook
// ---------------------------------------------------------------------------

interface MetricDropdownProps {
  geoLevel: GeoLevel;
  selectedMetric: string;
  onMetricChange: (metricId: string) => void;
}

function MetricDropdown({
  geoLevel,
  selectedMetric,
  onMetricChange,
}: MetricDropdownProps) {
  const { options } = useAllMetricOptions(geoLevel);

  const selectedLabel =
    options.find((o) => o.value === selectedMetric)?.label ?? "Select metric";

  return (
    <select
      value={selectedMetric}
      onChange={(e) => onMetricChange(e.target.value)}
      className="h-9 px-3 rounded-full bg-surface-container text-on-surface text-sm font-medium border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/40 truncate max-w-[200px]"
      aria-label="Select metric"
      title={selectedLabel}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled || option.locked}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}
