/**
 * GeographySelector Component
 *
 * Allows selection of geography type and specific geography for score viewing.
 * Supports state, metro, county, and zip code selection.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

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
    selected?.type || 'state',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch options using Mapbox Geocoding API
  const fetchOptions = useCallback(async () => {
    if (searchQuery.length < 2) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token) {
        console.warn('Mapbox token not found');
        setOptions([]);
        return;
      }

      // Map geo type to Mapbox place types
      const typeMapping: Record<string, string> = {
        state: 'region',
        metro: 'place,district',
        county: 'district',
        zip: 'postcode',
      };

      const mapboxTypes = typeMapping[geoType] || 'place';

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
          `access_token=${token}&` +
          `country=US&` +
          `types=${mapboxTypes}&` +
          `limit=8`,
      );

      if (response.ok) {
        const data = await response.json();
        const mappedResults = data.features?.map((feature: any) => {
          // Extract state context for display
          const stateContext = feature.context?.find((c: any) => c.id.startsWith('region'));
          const stateAbbrev = stateContext?.short_code?.replace('US-', '') || '';

          // Build a cleaner name
          let displayName = feature.text;
          if (geoType === 'zip') {
            displayName = `${feature.text}${stateAbbrev ? ` (${stateAbbrev})` : ''}`;
          } else if (geoType === 'county') {
            displayName = `${feature.text}${stateAbbrev ? `, ${stateAbbrev}` : ''}`;
          } else if (geoType === 'metro' || geoType === 'state') {
            displayName = feature.place_name?.split(',')[0] || feature.text;
          }

          // Build ID based on type
          let id = feature.id;
          if (geoType === 'zip') {
            id = feature.text; // Use zip code as ID
          } else if (geoType === 'state') {
            id = stateAbbrev || feature.properties?.short_code?.replace('US-', '') || feature.text;
          }

          return {
            id,
            name: displayName,
          };
        }) || [];

        setOptions(mappedResults);
      }
    } catch (error) {
      console.error('Error fetching geography options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [geoType, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(fetchOptions, 300);
    return () => clearTimeout(timer);
  }, [fetchOptions]);

  const handleSelect = (option: { id: string; name: string }) => {
    onChange(geoType, option.id, option.name);
    setSearchQuery(option.name);
    setShowDropdown(false);
  };

  const handleTypeChange = (newType: 'state' | 'metro' | 'county' | 'zip') => {
    setGeoType(newType);
    setSearchQuery('');
    setOptions([]);
  };

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

      <div className="relative flex-1 min-w-[200px] max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder={`Search ${geoType}...`}
          className="w-full px-4 py-2 rounded-lg border border-outline bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {/* Dropdown */}
        {showDropdown && (searchQuery.length >= 2 || options.length > 0) && (
          <div className="absolute z-10 w-full mt-1 bg-surface-container rounded-lg shadow-lg border border-outline-variant max-h-60 overflow-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm text-on-surface-variant">Searching...</div>
            ) : options.length > 0 ? (
              options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelect(option)}
                  className="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  {option.name}
                </button>
              ))
            ) : searchQuery.length >= 2 ? (
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
              onChange('state', '', '');
              setSearchQuery('');
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
