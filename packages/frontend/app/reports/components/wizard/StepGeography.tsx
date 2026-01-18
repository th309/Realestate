'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, X, Plus } from 'lucide-react';
import { SearchIcon, LocationPinIcon, MailboxIcon, BuildingIcon } from '@/app/map/components/Icons';
import { GEO_LEVEL_OPTIONS } from '../../constants';
import { useReportSearch } from '../../hooks/useReportSearch';
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

  // Use the Mapbox search hook with geo level filter
  const primarySearch = useReportSearch(geoLevel);
  const comparisonSearch = useReportSearch(geoLevel);

  // Reset search when geo level changes
  useEffect(() => {
    primarySearch.clearSearch();
    comparisonSearch.clearSearch();
  }, [geoLevel]);

  const isComparison = selectedTemplate?.config.comparison !== undefined;
  const maxComparisons = selectedTemplate?.config.comparison?.max_geographies || 5;
  const minComparisons = selectedTemplate?.config.comparison?.min_geographies || 2;

  // Filter supported geo levels
  const supportedGeoLevels = GEO_LEVEL_OPTIONS.filter(
    (opt) => selectedTemplate?.config.supported_geography_types.includes(opt.value as GeographyType)
  );

  // Filter out already selected geographies from results
  const filterSelected = (results: Geography[]) => {
    return results.filter((geo) => {
      if (primaryGeography?.id === geo.id) return false;
      if (comparisonGeographies.some((g) => g.id === geo.id)) return false;
      return true;
    });
  };

  const handleSelectPrimary = (geo: Geography) => {
    // Override the type to match the selected geo level
    const geoWithLevel: Geography = { ...geo, type: geoLevel };
    setPrimaryGeography(geoWithLevel);
    primarySearch.clearSearch();
  };

  const handleSelectComparison = (geo: Geography) => {
    const geoWithLevel: Geography = { ...geo, type: geoLevel };
    addComparisonGeography(geoWithLevel);
    comparisonSearch.clearSearch();
  };

  const getIconForType = (type: GeographyType) => {
    switch (type) {
      case 'zip':
        return <MailboxIcon />;
      case 'county':
        return <BuildingIcon />;
      default:
        return <LocationPinIcon />;
    }
  };

  return (
    <div>
      {/* Geography Level Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-on-surface mb-3">
          Geography Level
        </label>
        <div className="flex gap-2">
          {supportedGeoLevels.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGeoLevel(opt.value as GeographyType)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                ${
                  geoLevel === opt.value
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Geography Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-on-surface mb-3">
          {isComparison ? 'Primary Market' : 'Select Market'}
        </label>

        {primaryGeography ? (
          <div className="flex items-center gap-3 p-3 bg-primary-container rounded-xl">
            <MapPin className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <div className="font-medium text-on-primary-container">{primaryGeography.name}</div>
              <div className="text-xs text-on-primary-container/70 capitalize">{primaryGeography.type}</div>
            </div>
            <button
              onClick={() => setPrimaryGeography(null)}
              className="p-1.5 rounded-lg hover:bg-primary/20 transition-colors"
            >
              <X className="w-4 h-4 text-primary" />
            </button>
          </div>
        ) : (
          <div className="relative" ref={primarySearch.searchRef}>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
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
                placeholder={`Search for a ${geoLevel === 'zip' ? 'ZIP code' : geoLevel}...`}
                className="w-full h-14 pl-12 pr-4 bg-surface-container-high rounded-full text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-200"
              />
            </div>

            {/* Search Results Dropdown */}
            {primarySearch.showSearchResults && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-xl elevation-2 border border-outline-variant overflow-hidden z-50">
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
                ) : null}
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
                <MapPin className="w-5 h-5 text-on-surface-variant" />
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
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
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
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-xl elevation-2 border border-outline-variant overflow-hidden z-50">
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
                  ) : null}
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
