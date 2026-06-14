/**
 * GeographySelector Component
 *
 * Allows selection of geography type and specific geography for score viewing.
 * Supports metro, county, and zip code selection.
 * NOTE: State scoring is not yet supported by the API.
 *
 * Uses the same search logic as the graphs page (useGraphSearch hook)
 * for consistent behavior across the application.
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect } from 'react';
import { useGraphSearch } from '@/app/graphs/hooks/useGraphSearch';
import type { SearchResult } from '@/app/map/types';

interface Geography {
  type: 'metro' | 'county' | 'zip';
  id: string;
  name: string;
}

interface GeographySelectorProps {
  selected: Geography | null;
  onChange: (type: 'metro' | 'county' | 'zip', id: string, name: string) => void;
}

// Note: State scoring not yet supported by API
const GEO_TYPES = [
  { value: 'metro', label: 'Metro Area' },
  { value: 'county', label: 'County' },
  { value: 'zip', label: 'ZIP Code' },
] as const;

export function GeographySelector({ selected, onChange }: GeographySelectorProps) {
  const [geoType, setGeoType] = useState<'metro' | 'county' | 'zip'>(
    (selected?.type as 'metro' | 'county' | 'zip') || 'metro',
  );
  const [inputValue, setInputValue] = useState('');

  console.log('[GeographySelector] Render - geoType:', geoType, 'selected:', selected);

  // Use the same search hook as the graphs page (now supports state, metro, county, zip)
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
  } = useGraphSearch(geoType);

  // Sync input value with search query
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  const handleSelect = (result: SearchResult) => {
    console.log('[GeographySelector] handleSelect called with result:', result);
    console.log('[GeographySelector] Current geoType:', geoType);

    // Extract the proper ID for the scoring API
    // - Metros: use CBSA code from result.id (format: "metro-12420" -> "12420")
    // - Counties: use FIPS code from result.id (format: "county-17031" -> "17031")
    // - ZIPs: use ZIP code from result.value (e.g., "90210")
    let id: string;
    if (geoType === 'metro' && result.id.startsWith('metro-')) {
      id = result.id.replace('metro-', '');
      console.log('[GeographySelector] Extracted metro CBSA code:', id);
    } else if (geoType === 'county' && result.id.startsWith('county-')) {
      id = result.id.replace('county-', '');
      console.log('[GeographySelector] Extracted county FIPS code:', id);
    } else if (geoType === 'zip') {
      // For ZIP, use the value (ZIP code) or extract from id
      id = result.value || result.id.replace('zip-', '');
      console.log('[GeographySelector] Extracted ZIP code:', id);
    } else {
      id = result.value || result.name;
      console.log('[GeographySelector] Using fallback ID:', id);
    }

    console.log('[GeographySelector] Calling onChange with:', { type: geoType, id, name: result.name });
    onChange(geoType, id, result.name);
    setInputValue(result.name);
    clearSearch();
  };

  const handleTypeChange = (newType: 'metro' | 'county' | 'zip') => {
    console.log('[GeographySelector] handleTypeChange:', newType);
    setGeoType(newType);
    setInputValue('');
    clearSearch();
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    handleSearch(value);
  };

  // Get placeholder text based on geo level
  const getSearchPlaceholder = () => {
    switch (geoType) {
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

  // Minimum query length for search
  const minQueryLength = 2;

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

      <div className="relative flex-1 min-w-[200px] max-w-md" ref={searchRef}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (searchResults.length > 0) setShowSearchResults(true);
          }}
          placeholder={getSearchPlaceholder()}
          className="w-full px-4 py-2 rounded-lg border border-outline bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {/* Dropdown - unified for all geography types */}
        {showSearchResults && (inputValue.length >= minQueryLength || searchResults.length > 0) && (
          <div className="absolute z-10 w-full mt-1 bg-surface-container rounded-lg shadow-lg border border-outline-variant max-h-60 overflow-auto">
            {searchLoading ? (
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
            ) : inputValue.length >= minQueryLength ? (
              <div className="px-4 py-3 text-sm text-on-surface-variant">No results found</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Selected geography display */}
      {selected && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container">
          <span className="text-sm font-medium">{selected.name}</span>
          <button
            onClick={() => {
              console.log('[GeographySelector] Clearing selection');
              onChange('metro', '', '');
              clearSearch();
              setInputValue('');
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
