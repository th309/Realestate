/**
 * GeographySelector Component
 *
 * Allows selection of geography type and specific geography for score viewing.
 * Supports state, metro, county, and zip code selection.
 *
 * Uses the same search logic as the graphs page (useGraphSearch hook)
 * for consistent behavior across the application. State search is handled
 * locally since useGraphSearch doesn't support states.
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useGraphSearch } from '@/app/graphs/hooks/useGraphSearch';
import type { SearchResult } from '@/app/map/types';
import { US_STATES } from '@/app/map/types';

interface Geography {
  type: 'state' | 'metro' | 'county' | 'zip';
  id: string;
  name: string;
}

interface GeographySelectorProps {
  selected: Geography | null;
  onChange: (type: 'state' | 'metro' | 'county' | 'zip', id: string, name: string) => void;
}

const GEO_TYPES = [
  { value: 'state', label: 'State' },
  { value: 'metro', label: 'Metro Area' },
  { value: 'county', label: 'County' },
  { value: 'zip', label: 'ZIP Code' },
] as const;

export function GeographySelector({ selected, onChange }: GeographySelectorProps) {
  const [geoType, setGeoType] = useState<'state' | 'metro' | 'county' | 'zip'>(
    (selected?.type as 'state' | 'metro' | 'county' | 'zip') || 'state',
  );
  const [inputValue, setInputValue] = useState('');
  const [showStateDropdown, setShowStateDropdown] = useState(false);

  // Use the same search hook as the graphs page (for metro, county, zip)
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
  } = useGraphSearch(geoType === 'state' ? undefined : geoType);

  // Local state search (useGraphSearch doesn't support states)
  const filteredStates = useMemo(() => {
    if (geoType !== 'state' || inputValue.length < 1) return [];
    const query = inputValue.toLowerCase();
    return US_STATES.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.abbrev.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [geoType, inputValue]);

  // Sync input value with search query (for non-state types)
  useEffect(() => {
    if (geoType !== 'state') {
      setInputValue(searchQuery);
    }
  }, [searchQuery, geoType]);

  const handleSelect = (result: SearchResult) => {
    const id = result.value || result.name;
    onChange(geoType, id, result.name);
    setInputValue(result.name);
    clearSearch();
    setShowStateDropdown(false);
  };

  const handleStateSelect = (state: { abbrev: string; name: string }) => {
    onChange('state', state.abbrev, state.name);
    setInputValue(state.name);
    setShowStateDropdown(false);
  };

  const handleTypeChange = (newType: 'state' | 'metro' | 'county' | 'zip') => {
    setGeoType(newType);
    setInputValue('');
    clearSearch();
    setShowStateDropdown(false);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (geoType === 'state') {
      setShowStateDropdown(true);
    } else {
      handleSearch(value);
    }
  };

  // Get placeholder text based on geo level
  const getSearchPlaceholder = () => {
    switch (geoType) {
      case 'state':
        return 'Search states (e.g., California, TX)';
      case 'metro':
        return 'Search metros (e.g., Chicago, Miami)';
      case 'county':
        return 'Search counties (e.g., Cook, Harris)';
      case 'zip':
        return 'Search ZIP codes (e.g., 90210, 33139)';
      default:
        return 'Search location';
    }
  };

  // Determine if dropdown should show
  const shouldShowDropdown = geoType === 'state'
    ? showStateDropdown && (inputValue.length >= 1 || filteredStates.length > 0)
    : showSearchResults && (inputValue.length >= 2 || searchResults.length > 0);

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-on-surface-variant">Geography:</label>
        <div className="flex gap-1">
          {GEO_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => handleTypeChange(type.value)}
              className={`
                px-3 py-1.5 text-sm rounded-lg transition-colors
                ${
                  geoType === type.value
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                }
              `}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 min-w-[200px] max-w-md" ref={geoType === 'state' ? undefined : searchRef}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (geoType === 'state') {
              setShowStateDropdown(true);
            } else if (searchResults.length > 0) {
              setShowSearchResults(true);
            }
          }}
          onBlur={() => {
            // Delay to allow click on dropdown item
            setTimeout(() => setShowStateDropdown(false), 200);
          }}
          placeholder={getSearchPlaceholder()}
          className="w-full px-4 py-2 rounded-lg border border-outline bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {/* Dropdown */}
        {shouldShowDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-surface-container rounded-lg shadow-lg border border-outline-variant max-h-60 overflow-auto">
            {geoType === 'state' ? (
              // State search results
              filteredStates.length > 0 ? (
                filteredStates.map((state) => (
                  <button
                    key={state.abbrev}
                    onClick={() => handleStateSelect(state)}
                    className="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    <div className="font-medium">{state.name}</div>
                    <div className="text-xs text-on-surface-variant">{state.abbrev}</div>
                  </button>
                ))
              ) : inputValue.length >= 1 ? (
                <div className="px-4 py-3 text-sm text-on-surface-variant">No states found</div>
              ) : null
            ) : (
              // Metro, county, zip search results
              searchLoading ? (
                <div className="px-4 py-3 text-sm text-on-surface-variant flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-container border-t-primary rounded-full animate-spin"></div>
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    className="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    <div className="font-medium">{result.name}</div>
                    {result.subtitle && (
                      <div className="text-xs text-on-surface-variant">{result.subtitle}</div>
                    )}
                  </button>
                ))
              ) : inputValue.length >= 2 ? (
                <div className="px-4 py-3 text-sm text-on-surface-variant">No results found</div>
              ) : null
            )}
          </div>
        )}
      </div>

      {/* Selected geography display */}
      {selected && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container">
          <span className="text-sm font-medium">{selected.name}</span>
          <button
            onClick={() => {
              onChange('state', '', '');
              clearSearch();
              setInputValue('');
              setShowStateDropdown(false);
            }}
            className="text-on-secondary-container/60 hover:text-on-secondary-container"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
