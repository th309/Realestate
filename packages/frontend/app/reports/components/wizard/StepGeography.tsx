'use client';

import React, { useState } from 'react';
import { Search, MapPin, X, Plus } from 'lucide-react';
import { GEO_LEVEL_OPTIONS } from '../../constants';
import type { UseWizardStateReturn } from '../../hooks/useWizardState';
import type { Geography, GeographyType } from '../../types';

// Mock geography search results
const MOCK_GEOGRAPHIES: Record<GeographyType, Geography[]> = {
  metro: [
    { id: '31080', type: 'metro', name: 'Los Angeles-Long Beach-Anaheim, CA', state: 'CA' },
    { id: '35620', type: 'metro', name: 'New York-Newark-Jersey City, NY-NJ-PA', state: 'NY' },
    { id: '16980', type: 'metro', name: 'Chicago-Naperville-Elgin, IL-IN-WI', state: 'IL' },
    { id: '19100', type: 'metro', name: 'Dallas-Fort Worth-Arlington, TX', state: 'TX' },
    { id: '26420', type: 'metro', name: 'Houston-The Woodlands-Sugar Land, TX', state: 'TX' },
    { id: '38060', type: 'metro', name: 'Phoenix-Mesa-Chandler, AZ', state: 'AZ' },
    { id: '33100', type: 'metro', name: 'Miami-Fort Lauderdale-Pompano Beach, FL', state: 'FL' },
    { id: '12060', type: 'metro', name: 'Atlanta-Sandy Springs-Alpharetta, GA', state: 'GA' },
  ],
  county: [
    { id: '06037', type: 'county', name: 'Los Angeles County', state: 'CA' },
    { id: '36061', type: 'county', name: 'New York County (Manhattan)', state: 'NY' },
    { id: '17031', type: 'county', name: 'Cook County', state: 'IL' },
    { id: '48201', type: 'county', name: 'Harris County', state: 'TX' },
    { id: '04013', type: 'county', name: 'Maricopa County', state: 'AZ' },
  ],
  zip: [
    { id: '90210', type: 'zip', name: '90210 - Beverly Hills', state: 'CA' },
    { id: '10001', type: 'zip', name: '10001 - New York', state: 'NY' },
    { id: '60601', type: 'zip', name: '60601 - Chicago', state: 'IL' },
    { id: '85001', type: 'zip', name: '85001 - Phoenix', state: 'AZ' },
  ],
};

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

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchingFor, setSearchingFor] = useState<'primary' | 'comparison'>('primary');

  const isComparison = selectedTemplate?.config.comparison !== undefined;
  const maxComparisons = selectedTemplate?.config.comparison?.max_geographies || 5;
  const minComparisons = selectedTemplate?.config.comparison?.min_geographies || 2;

  // Filter supported geo levels
  const supportedGeoLevels = GEO_LEVEL_OPTIONS.filter(
    (opt) => selectedTemplate?.config.supported_geography_types.includes(opt.value as GeographyType)
  );

  // Filter search results
  const searchResults = MOCK_GEOGRAPHIES[geoLevel].filter((geo) => {
    if (!searchQuery) return true;
    return geo.name.toLowerCase().includes(searchQuery.toLowerCase());
  }).filter((geo) => {
    // Exclude already selected geographies
    if (primaryGeography?.id === geo.id) return false;
    if (comparisonGeographies.some((g) => g.id === geo.id)) return false;
    return true;
  });

  const handleSelectGeography = (geo: Geography) => {
    if (searchingFor === 'primary') {
      setPrimaryGeography(geo);
    } else {
      addComparisonGeography(geo);
    }
    setSearchQuery('');
    setIsSearchFocused(false);
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
              <div className="text-xs text-on-primary-container/70">{primaryGeography.state}</div>
            </div>
            <button
              onClick={() => setPrimaryGeography(null)}
              className="p-1.5 rounded-lg hover:bg-primary/20 transition-colors"
            >
              <X className="w-4 h-4 text-primary" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  setIsSearchFocused(true);
                  setSearchingFor('primary');
                }}
                placeholder={`Search for a ${geoLevel}...`}
                className="w-full pl-10 pr-4 py-3 bg-surface-container rounded-xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Search Results Dropdown */}
            {isSearchFocused && searchingFor === 'primary' && (
              <div className="absolute z-10 w-full mt-2 bg-surface-container-high rounded-xl elevation-2 overflow-hidden max-h-60 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.slice(0, 8).map((geo) => (
                    <button
                      key={geo.id}
                      onClick={() => handleSelectGeography(geo)}
                      className="w-full px-4 py-3 text-left hover:bg-surface-container transition-colors flex items-center gap-3"
                    >
                      <MapPin className="w-4 h-4 text-on-surface-variant shrink-0" />
                      <div>
                        <div className="text-sm text-on-surface">{geo.name}</div>
                        <div className="text-xs text-on-surface-variant">{geo.state}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-on-surface-variant">No results found</div>
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
                <MapPin className="w-5 h-5 text-on-surface-variant" />
                <div className="flex-1">
                  <div className="font-medium text-on-surface">{geo.name}</div>
                  <div className="text-xs text-on-surface-variant">{geo.state}</div>
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
            <div className="relative">
              <div className="relative">
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                <input
                  type="text"
                  value={searchingFor === 'comparison' ? searchQuery : ''}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    setIsSearchFocused(true);
                    setSearchingFor('comparison');
                    setSearchQuery('');
                  }}
                  placeholder="Add another market to compare..."
                  className="w-full pl-10 pr-4 py-3 bg-surface-container rounded-xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Search Results Dropdown */}
              {isSearchFocused && searchingFor === 'comparison' && (
                <div className="absolute z-10 w-full mt-2 bg-surface-container-high rounded-xl elevation-2 overflow-hidden max-h-60 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    searchResults.slice(0, 8).map((geo) => (
                      <button
                        key={geo.id}
                        onClick={() => handleSelectGeography(geo)}
                        className="w-full px-4 py-3 text-left hover:bg-surface-container transition-colors flex items-center gap-3"
                      >
                        <MapPin className="w-4 h-4 text-on-surface-variant shrink-0" />
                        <div>
                          <div className="text-sm text-on-surface">{geo.name}</div>
                          <div className="text-xs text-on-surface-variant">{geo.state}</div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-on-surface-variant">No results found</div>
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

      {/* Click outside to close */}
      {isSearchFocused && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsSearchFocused(false)}
        />
      )}
    </div>
  );
};
