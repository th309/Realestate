'use client';

import React, { useRef } from 'react';
import { Search, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUniversalSearch } from '@/app/shared/hooks/useUniversalSearch';

export function HeroSearchBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    searchQuery, searchResults, searchLoading,
    showSearchResults, setShowSearchResults,
    searchRef, handleSearch, clearSearch,
  } = useUniversalSearch({});

  const handleSelectResult = (result: { id: string; name: string; type: string; state?: string }) => {
    clearSearch();
    // Navigate to map with the selected geography
    const geoType = result.type;
    const geoId = result.id;
    router.push(`/map?geo=${geoType}&id=${geoId}`);
  };

  return (
    <div ref={searchRef as React.RefObject<HTMLDivElement>} className="relative w-full max-w-lg mx-auto">
      <div className="flex items-center bg-surface-container-lowest rounded-full border border-outline-variant shadow-md hover:shadow-lg transition-shadow px-5 py-3.5 gap-3">
        <Search className="w-5 h-5 text-on-surface-variant flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => { if (searchQuery.length >= 2) setShowSearchResults(true); }}
          placeholder="Search any city, metro, county, or ZIP..."
          className="flex-1 bg-transparent text-base text-on-surface placeholder:text-on-surface-variant/60 outline-none"
        />
      </div>

      {/* Search dropdown */}
      {showSearchResults && (
        <div className="absolute top-full mt-2 w-full bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/30 z-50 overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {searchLoading && (
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-on-surface-variant">Searching...</span>
              </div>
            )}

            {!searchLoading && searchResults.length === 0 && searchQuery.length >= 2 && (
              <p className="px-4 py-3 text-sm text-on-surface-variant text-center">
                No markets found
              </p>
            )}

            {searchResults.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelectResult(result)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-container transition-colors"
              >
                <MapPin className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-on-surface">{result.name}</div>
                  {result.subtitle && (
                    <div className="text-xs text-on-surface-variant">{result.subtitle}</div>
                  )}
                </div>
                <span className="text-[10px] text-on-surface-variant/60 uppercase tracking-wider flex-shrink-0 bg-surface-container-high px-1.5 py-0.5 rounded">
                  {result.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
