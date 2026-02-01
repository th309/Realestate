'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Globe, Map } from 'lucide-react';
import { SearchIcon, LocationPinIcon, MailboxIcon, BuildingIcon } from '@/app/map/components/Icons';
import { SearchBar } from '@/app/map/components/SearchBar';
import { useReportSearch, getStaticMapUrl, fetchGeographyCoordinates } from '../../hooks/useReportSearch';
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

  const [searchingFor, setSearchingFor] = useState<'primary' | 'comparison'>('primary');
  const prevGeoLevel = useRef(geoLevel);

  // Use the backend-driven search hook
  const primarySearch = useReportSearch(geoLevel);
  const comparisonSearch = useReportSearch(geoLevel);

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

  // Adapt Geography to SearchResult for the SearchBar component
  const mapGeoToResult = (geo: Geography): SearchResult => ({
    id: geo.id,
    name: geo.name,
    type: geo.type as any, // Cast to match SearchResult type
    value: geo.id,
    subtitle: geo.state ? `${geo.state}, United States` : undefined,
    center: geo.center,
    state: geo.state,
  });

  // Filter out already selected geographies from results
  const filterResults = (results: Geography[]): SearchResult[] => {
    return results
      .filter((geo) => {
        if (primaryGeography?.id === geo.id) return false;
        if (comparisonGeographies.some((g) => g.id === geo.id)) return false;
        return true;
      })
      .map(mapGeoToResult);
  };

  const handleSelectPrimary = async (result: SearchResult) => {
    // 1. Convert to initial Geography object
    const geo: Geography = {
      id: result.id,
      name: result.name,
      type: result.type as GeographyType,
      state: result.state,
      center: result.center || [0, 0], // Default
    };

    // 2. Optimistically set it (to show selection immediately)
    setPrimaryGeography(geo);
    primarySearch.clearSearch();

    // 3. Fetch precise coordinates if missing (backend returns 0,0)
    //    States usually have coords from STATE_CENTERS, so skip if valid
    const needsCoords = !geo.center || (geo.center[0] === 0 && geo.center[1] === 0);

    if (needsCoords) {
      const coords = await fetchGeographyCoordinates(geo.name, geo.type, geo.state);
      if (coords) {
        setPrimaryGeography({
          ...geo,
          center: coords.center,
          bbox: coords.bbox
        });
      }
    }
  };

  const handleSelectComparison = async (result: SearchResult) => {
    const geo: Geography = {
      id: result.id,
      name: result.name,
      type: result.type as GeographyType,
      state: result.state,
      center: result.center || [0, 0],
    };
    addComparisonGeography(geo);
    comparisonSearch.clearSearch();
    // No map fetch for comparison currently
  };

  const getIconForType = (type: GeographyType) => {
    switch (type) {
      case 'national': return <Globe className="w-5 h-5" />;
      case 'state': return <Map className="w-5 h-5" />;
      case 'zip': return <MailboxIcon />;
      case 'county': return <BuildingIcon />;
      default: return <LocationPinIcon />;
    }
  };

  const mapUrl = primaryGeography ? getStaticMapUrl(primaryGeography, 600, 200) : '';
  const showMap = !!mapUrl;

  const getSearchPlaceholder = () => {
    switch (geoLevel) {
      case 'metro': return 'Search metros (e.g., Chicago, Miami)';
      case 'county': return 'Search counties (e.g., Cook, Harris)';
      case 'city': return 'Search cities (e.g., Austin, Denver)';
      case 'zip': return 'Search ZIP codes (e.g., 90210, 33139)';
      default: return 'Search location';
    }
  };

  return (
    <div>
      {/* Primary Geography Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-on-surface mb-3">
          {isComparison ? 'Primary Market' : 'Select Market'}
        </label>

        {/* Geography Type Selector - Only show if no primary selection yet */}
        {!primaryGeography && (
          <div className="flex flex-wrap gap-2 mb-3">
            {(selectedTemplate?.config.supported_geography_types || ['metro', 'city', 'county', 'zip']).map((type) => {
              // Optional: prettify labels
              const label = type === 'metro' ? 'Metro' :
                type === 'zip' ? 'Zip Code' :
                  type.charAt(0).toUpperCase() + type.slice(1);
              const isActive = geoLevel === type;

              return (
                <button
                  key={type}
                  onClick={() => setGeoLevel(type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isActive
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {primaryGeography ? (
          <div className="space-y-3">
            {/* Selected Geography Card with Map Preview */}
            <div className="bg-primary-container rounded-2xl overflow-hidden">
              {/* Map Preview - Only show if we have valid coordinates */}
              {showMap && (
                <div className="relative h-32 bg-surface-container">
                  <img
                    src={mapUrl}
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
          <div>
            <SearchBar
              className="w-full"
              searchRef={primarySearch.searchRef}
              searchQuery={primarySearch.searchQuery}
              searchResults={filterResults(primarySearch.searchResults)}
              searchLoading={primarySearch.searchLoading}
              showSearchResults={primarySearch.showSearchResults}
              onSearch={primarySearch.handleSearch}
              onSelectResult={handleSelectPrimary}
              onFocus={() => {
                setSearchingFor('primary');
                if (primarySearch.searchResults.length > 0) primarySearch.setShowSearchResults(true);
              }}
              placeholder={getSearchPlaceholder()}
            />
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
            <div>
              <SearchBar
                className="w-full"
                searchRef={comparisonSearch.searchRef}
                searchQuery={comparisonSearch.searchQuery}
                searchResults={filterResults(comparisonSearch.searchResults)}
                searchLoading={comparisonSearch.searchLoading}
                showSearchResults={comparisonSearch.showSearchResults}
                onSearch={comparisonSearch.handleSearch}
                onSelectResult={handleSelectComparison}
                onFocus={() => {
                  setSearchingFor('comparison');
                  if (comparisonSearch.searchResults.length > 0) comparisonSearch.setShowSearchResults(true);
                }}
                placeholder="Add another market to compare..."
              />
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
