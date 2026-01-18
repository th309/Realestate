'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, X, Plus, Globe, Map } from 'lucide-react';
import { SearchIcon, LocationPinIcon, MailboxIcon, BuildingIcon } from '@/app/map/components/Icons';
import { GEO_LEVEL_OPTIONS } from '../../constants';
import { useReportSearch, getStaticMapUrl } from '../../hooks/useReportSearch';
import type { UseWizardStateReturn } from '../../hooks/useWizardState';
import type { Geography, GeographyType } from '../../types';

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

  const [searchingFor, setSearchingFor] = useState<'primary' | 'comparison'>('primary');
  const prevGeoLevel = useRef(geoLevel);

  // Use the Mapbox search hook - no geo level filter for unified search
  const primarySearch = useReportSearch();
  const comparisonSearch = useReportSearch();

  // Reset search when geo level changes (skip initial mount)
  useEffect(() => {
    if (prevGeoLevel.current !== geoLevel) {
      primarySearch.clearSearch();
      comparisonSearch.clearSearch();
      prevGeoLevel.current = geoLevel;
    }
  }, [geoLevel, primarySearch, comparisonSearch]);

  const isComparison = selectedTemplate?.config.comparison !== undefined;
  const maxComparisons = selectedTemplate?.config.comparison?.max_geographies || 5;
  const minComparisons = selectedTemplate?.config.comparison?.min_geographies || 2;

  // Filter out already selected geographies from results
  const filterSelected = (results: Geography[]) => {
    return results.filter((geo) => {
      if (primaryGeography?.id === geo.id) return false;
      if (comparisonGeographies.some((g) => g.id === geo.id)) return false;
      return true;
    });
  };

  const handleSelectPrimary = (geo: Geography) => {
    setPrimaryGeography(geo);
    primarySearch.clearSearch();
  };

  const handleSelectComparison = (geo: Geography) => {
    addComparisonGeography(geo);
    comparisonSearch.clearSearch();
  };

  const getIconForType = (type: GeographyType) => {
    switch (type) {
      case 'national':
        return <Globe className="w-5 h-5" />;
      case 'state':
        return <Map className="w-5 h-5" />;
      case 'zip':
        return <MailboxIcon />;
      case 'county':
        return <BuildingIcon />;
      default:
        return <LocationPinIcon />;
    }
  };

  const getPlaceholder = () => {
    return 'Search city, state, county, or ZIP code...';
  };

  return (
    <div>
      {/* Primary Geography Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-on-surface mb-3">
          {isComparison ? 'Primary Market' : 'Select Market'}
        </label>

        {primaryGeography ? (
          <div className="space-y-3">
            {/* Selected Geography Card with Map Preview */}
            <div className="bg-primary-container rounded-2xl overflow-hidden">
              {/* Map Preview */}
              {primaryGeography.center && (
                <div className="relative h-32 bg-surface-container">
                  <img
                    src={getStaticMapUrl(primaryGeography, 600, 200)}
                    alt={`Map of ${primaryGeography.name}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary-container/80 to-transparent" />
                </div>
              )}
              {/* Geography Info */}
              <div className="p-4 flex items-center gap-3">
                <div className="text-primary">
                  {getIconForType(primaryGeography.type)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-on-primary-container">{primaryGeography.name}</div>
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
        ) : (
          <div className="relative" ref={primarySearch.searchRef}>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <SearchIcon />
              </div>
              <input
                type="text"
                value={primarySearch.searchQuery}
                onChange={(e) => primarySearch.handleSearch(e.target.value)}
                onFocus={() => {
                  setSearchingFor('primary');
                  primarySearch.setShowSearchResults(true);
                }}
                placeholder={getPlaceholder()}
                className="w-full h-14 pl-12 pr-4 bg-surface-container-high rounded-full text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-200"
              />
            </div>

            {/* Search Results Dropdown */}
            {primarySearch.showSearchResults && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-xl elevation-2 border border-outline-variant overflow-hidden z-50 max-h-80 overflow-y-auto">
                {primarySearch.searchLoading ? (
                  <div className="px-4 py-3 text-sm text-on-surface-variant flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-container border-t-primary rounded-full animate-spin"></div>
                    Searching...
                  </div>
                ) : filterSelected(primarySearch.searchResults).length > 0 ? (
                  <ul>
                    {filterSelected(primarySearch.searchResults).map((result) => (
                      <li key={result.id}>
                        <button
                          onClick={() => handleSelectPrimary(result)}
                          className="w-full px-4 py-3 text-left hover:bg-surface-container flex items-center gap-3 transition-colors duration-200"
                        >
                          <span className="text-on-surface-variant">
                            {getIconForType(result.type)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-on-surface truncate">{result.name}</div>
                            <div className="text-xs text-on-surface-variant capitalize">{result.type}</div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : primarySearch.searchQuery.length >= 2 ? (
                  <div className="px-4 py-3 text-sm text-on-surface-variant">No results found</div>
                ) : (
                  <div className="px-4 py-3 text-sm text-on-surface-variant">
                    Type to search for a location...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comparison Markets (if applicable) */}
      {isComparison && primaryGeography && (
        <div>
          <label className="block text-sm font-medium text-on-surface mb-3">
            Comparison Markets ({comparisonGeographies.length + 1}/{maxComparisons})
          </label>

          {/* Selected comparison markets */}
          <div className="space-y-2 mb-4">
            {comparisonGeographies.map((geo) => (
              <div
                key={geo.id}
                className="flex items-center gap-3 p-3 bg-surface-container rounded-xl"
              >
                <span className="text-on-surface-variant">
                  {getIconForType(geo.type)}
                </span>
                <div className="flex-1">
                  <div className="font-medium text-on-surface">{geo.name}</div>
                  <div className="text-xs text-on-surface-variant capitalize">{geo.type}</div>
                </div>
                <button
                  onClick={() => removeComparisonGeography(geo.id)}
                  className="p-1.5 rounded-lg hover:bg-error/10 transition-colors"
                >
                  <X className="w-4 h-4 text-error" />
                </button>
              </div>
            ))}
          </div>

          {/* Add comparison market */}
          {comparisonGeographies.length < maxComparisons - 1 && (
            <div className="relative" ref={comparisonSearch.searchRef}>
              <div className="relative">
                <Plus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                <input
                  type="text"
                  value={comparisonSearch.searchQuery}
                  onChange={(e) => comparisonSearch.handleSearch(e.target.value)}
                  onFocus={() => {
                    setSearchingFor('comparison');
                    comparisonSearch.setShowSearchResults(true);
                  }}
                  placeholder="Add another market to compare..."
                  className="w-full h-14 pl-12 pr-4 bg-surface-container-high rounded-full text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-200"
                />
              </div>

              {/* Search Results Dropdown */}
              {comparisonSearch.showSearchResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-xl elevation-2 border border-outline-variant overflow-hidden z-50 max-h-80 overflow-y-auto">
                  {comparisonSearch.searchLoading ? (
                    <div className="px-4 py-3 text-sm text-on-surface-variant flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-container border-t-primary rounded-full animate-spin"></div>
                      Searching...
                    </div>
                  ) : filterSelected(comparisonSearch.searchResults).length > 0 ? (
                    <ul>
                      {filterSelected(comparisonSearch.searchResults).map((result) => (
                        <li key={result.id}>
                          <button
                            onClick={() => handleSelectComparison(result)}
                            className="w-full px-4 py-3 text-left hover:bg-surface-container flex items-center gap-3 transition-colors duration-200"
                          >
                            <span className="text-on-surface-variant">
                              {getIconForType(result.type)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-on-surface truncate">{result.name}</div>
                              <div className="text-xs text-on-surface-variant capitalize">{result.type}</div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : comparisonSearch.searchQuery.length >= 2 ? (
                    <div className="px-4 py-3 text-sm text-on-surface-variant">No results found</div>
                  ) : (
                    <div className="px-4 py-3 text-sm text-on-surface-variant">
                      Type to search for a location...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Minimum comparison note */}
          {comparisonGeographies.length < minComparisons - 1 && (
            <p className="text-xs text-on-surface-variant mt-2">
              Select at least {minComparisons} markets for comparison
            </p>
          )}
        </div>
      )}
    </div>
  );
};
