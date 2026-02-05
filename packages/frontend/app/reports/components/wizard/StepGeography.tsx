'use client';

import React from 'react';
import { X, Globe, Map as MapIcon } from 'lucide-react';

import { SearchIcon, LocationPinIcon, MailboxIcon, BuildingIcon, MetroIcon } from '@/app/map/components/Icons';
import { SearchWidget } from '@/app/map/components/SearchWidget';
import { useUniversalSearch } from '@/app/shared/hooks/useUniversalSearch';
import { getStaticMapUrl, fetchGeographyCoordinates } from '../../hooks/useReportSearch';
import type { UseWizardStateReturn } from '../../hooks/useWizardState';
import type { Geography, GeographyType } from '../../types';
import type { SearchResult } from '@/app/map/types';

interface StepGeographyProps {
  wizardState: UseWizardStateReturn;
}

export const StepGeography: React.FC<StepGeographyProps> = ({ wizardState }) => {
  const {
    selectedTemplate,
    geoLevel,
    setGeoLevel,
    primaryGeography,
    setPrimaryGeography,
    comparisonGeographies,
    addComparisonGeography,
    removeComparisonGeography,
  } = wizardState;

  // Determine search filter:
  // - If no primary is selected: Universal search (no filter)
  // - If primary is selected: Lock to that type for comparisons
  const searchFilter = primaryGeography ? primaryGeography.type : undefined;

  // Use the universal search hook
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
  } = useUniversalSearch({
    accessToken: '', // Mapbox accessToken is handled internally or by global mapboxgl
    filterByGeoLevel: searchFilter
  });

  const isComparison = selectedTemplate?.config.comparison !== undefined;
  const maxComparisons = selectedTemplate?.config.comparison?.max_geographies || 5;
  const minComparisons = selectedTemplate?.config.comparison?.min_geographies || 2;

  // Filter out already selected geographies from results
  const availableResults = searchResults.filter((result) => {
    if (primaryGeography?.id === result.id) return false;
    if (comparisonGeographies.some((g) => g.id === result.id)) return false;
    return true;
  });

  const handleSelectResult = async (result: SearchResult) => {
    // 1. Convert to initial Geography object
    const geo: Geography = {
      id: result.id,
      name: result.name,
      type: result.type as GeographyType,
      state: result.state,
      center: result.center || [0, 0],
    };

    // 2. Decide role: Primary if none, otherwise comparison
    if (!primaryGeography) {
      wizardState.setGeographySelection(geo);
      clearSearch();

      // 3. Hydrate coordinates if needed for map preview
      if (!geo.center || (geo.center[0] === 0 && geo.center[1] === 0)) {
        const coords = await fetchGeographyCoordinates(geo.name, geo.type, geo.state);
        if (coords) {
          setPrimaryGeography({
            ...geo,
            center: coords.center,
            bbox: coords.bbox
          });
        }
      }
    } else if (isComparison && comparisonGeographies.length < maxComparisons - 1) {
      addComparisonGeography(geo);
      clearSearch();
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'national': return <Globe className="w-5 h-5" />;
      case 'state': return <MapIcon className="w-5 h-5" />;
      case 'zip': return <MailboxIcon />;
      case 'county': return <BuildingIcon />;
      case 'metro': return <MetroIcon />;
      default: return <LocationPinIcon />;
    }
  };

  const mapUrl = primaryGeography ? getStaticMapUrl(primaryGeography, 600, 200) : '';
  const showMap = !!mapUrl;

  return (
    <div className="space-y-6">
      {/* Primary Location Search */}
      {!primaryGeography && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium text-on-surface">
              Search for the main location of your report
            </label>
          </div>
          <SearchWidget
            className="w-full"
            searchRef={searchRef}
            searchQuery={searchQuery}
            searchResults={availableResults}
            searchLoading={searchLoading}
            showSearchResults={showSearchResults}
            onSearch={handleSearch}
            onSelectResult={handleSelectResult}
            onFocus={() => {
              if (searchResults.length > 0) setShowSearchResults(true);
            }}
            placeholder="Enter a state, metro, county, or zip..."
          />
        </div>
      )}

      {/* Comparison Search - only show for comparison templates */}
      {primaryGeography && isComparison && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium text-on-surface">
              Add Comparisons
            </label>
            <span className="text-xs text-on-surface-variant">
              {comparisonGeographies.length + 1} / {maxComparisons} markets
            </span>
          </div>
          {comparisonGeographies.length < maxComparisons - 1 ? (
            <SearchWidget
              className="w-full"
              searchRef={searchRef}
              searchQuery={searchQuery}
              searchResults={availableResults}
              searchLoading={searchLoading}
              showSearchResults={showSearchResults}
              onSearch={handleSearch}
              onSelectResult={handleSelectResult}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchResults(true);
              }}
              placeholder="Add another location to compare..."
            />
          ) : (
            <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/30 text-center text-sm text-on-surface-variant">
              Maximum of {maxComparisons} markets selected.
            </div>
          )}
        </div>
      )}

      {/* Selected Markets Display */}
      <div className="space-y-4">
        {primaryGeography && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">
              Primary Selection
            </span>
            <div className="bg-primary-container rounded-2xl overflow-hidden border border-primary/10">
              {showMap && (
                <div className="relative h-24 bg-surface-container">
                  <img
                    src={mapUrl}
                    alt={primaryGeography.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary-container/90 to-transparent" />
                </div>
              )}
              <div className="p-4 flex items-center gap-3">
                <div className="text-primary p-2 bg-on-primary/10 rounded-lg">
                  {getIconForType(primaryGeography.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-on-primary-container truncate">{primaryGeography.name}</div>
                  <div className="text-xs text-on-primary-container/70 capitalize">{primaryGeography.type}</div>
                </div>
                <button
                  onClick={() => setPrimaryGeography(null)}
                  className="p-2 rounded-full hover:bg-primary/20 transition-colors"
                >
                  <X className="w-5 h-5 text-primary" />
                </button>
              </div>
            </div>
          </div>
        )}

        {isComparison && comparisonGeographies.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">
              Comparisons ({comparisonGeographies.length} / {maxComparisons - 1})
            </span>
            <div className="grid grid-cols-1 gap-2">
              {comparisonGeographies.map((geo) => (
                <div
                  key={geo.id}
                  className="flex items-center gap-3 p-3 bg-surface-container rounded-xl border border-outline-variant/30 hover:bg-surface-container-high transition-colors"
                >
                  <div className="text-on-surface-variant opacity-70">
                    {getIconForType(geo.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-on-surface truncate">{geo.name}</div>
                    <div className="text-[10px] text-on-surface-variant/70 capitalize">{geo.type}</div>
                  </div>
                  <button
                    onClick={() => removeComparisonGeography(geo.id)}
                    className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Minimum selection warning */}
      {isComparison && comparisonGeographies.length < minComparisons - 1 && primaryGeography && (
        <div className="flex items-center gap-2 p-3 bg-surface-container-high/50 rounded-xl text-xs text-on-surface-variant">
          <LocationPinIcon />
          <span>Select at least {minComparisons - 1} more market{minComparisons - 1 > 1 ? 's' : ''} to enable comparison analysis.</span>
        </div>
      )}
    </div>
  );
};

