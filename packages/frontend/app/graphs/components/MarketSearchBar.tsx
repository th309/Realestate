'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowLeftRight } from 'lucide-react';
import { MyMarket } from '../hooks/useMyMarkets';
import { useUniversalSearch } from '@/app/shared/hooks/useUniversalSearch';

interface MarketSearchBarProps {
  primaryMarket: MyMarket | null;
  comparisonMarket: MyMarket | null;
  onSelectMarket: (market: MyMarket) => void;
  onClearComparison: () => void;
  onSwapMarkets: () => void;
}

export function MarketSearchBar({
  primaryMarket,
  comparisonMarket,
  onSelectMarket,
  onClearComparison,
  onSwapMarkets,
}: MarketSearchBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Universal search across all geo types (metros, counties, ZIPs, cities)
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
  } = useUniversalSearch({});

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  const handleSelectResult = (result: any) => {
    // Convert universal search result to MyMarket format
    // Universal search returns clean IDs: CBSA codes for metros, FIPS for counties, ZIP codes for zips
    // Only metro/county/zip types are shown (filtered below), so no fallback needed
    const market: MyMarket = {
      id: result.id,
      name: result.name,
      type: result.type as 'metro' | 'county' | 'zip',
      state: result.state,
      score: null,
    };

    onSelectMarket(market);
    setSearchOpen(false);
    clearSearch();
  };

  // Graphs page only supports metro, county, zip — filter out states/national/city
  const supportedResults = searchResults.filter(
    (r) => r.type === 'metro' || r.type === 'county' || r.type === 'zip'
  );

  return (
    <div ref={searchRef as React.RefObject<HTMLDivElement>} className="flex items-center gap-2 relative">
      {/* Market chips */}
      <div className="flex items-center gap-2">
        {primaryMarket ? (
          <MarketChip
            market={primaryMarket}
            color="primary"
            onRemove={() => onClearComparison()}
          />
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface-variant text-sm hover:bg-surface-container-high transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search market...</span>
          </button>
        )}

        {primaryMarket && comparisonMarket && (
          <>
            <button
              onClick={onSwapMarkets}
              className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
              title="Swap markets"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            <MarketChip
              market={comparisonMarket}
              color="comparison"
              onRemove={() => onSelectMarket(comparisonMarket)} // Deselects comparison
            />
          </>
        )}

        {primaryMarket && !comparisonMarket && (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-primary hover:bg-primary-container/30 transition-colors"
          >
            <span>+ Compare</span>
          </button>
        )}
      </div>

      {/* Search button (when markets are already set) */}
      {primaryMarket && !searchOpen && (
        <button
          onClick={() => setSearchOpen(true)}
          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
          title="Search markets"
        >
          <Search className="w-4 h-4" />
        </button>
      )}

      {/* Search input */}
      {searchOpen && (
        <div className="absolute left-0 top-full mt-2 min-w-[320px] w-max max-w-[420px] bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/30 z-50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-outline-variant/20">
            <Search className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search city, metro, county, ZIP..."
              className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none"
            />
            <button
              onClick={() => { setSearchOpen(false); clearSearch(); }}
              className="p-0.5 rounded text-on-surface-variant hover:text-on-surface"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {searchLoading && (
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-on-surface-variant">Searching...</span>
              </div>
            )}

            {!searchLoading && showSearchResults && supportedResults.length === 0 && searchQuery.length >= 2 && (
              <p className="px-4 py-3 text-xs text-on-surface-variant text-center">
                No markets found
              </p>
            )}

            {supportedResults.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelectResult(result)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-on-surface whitespace-nowrap">{result.name}</div>
                  {result.subtitle && (
                    <div className="text-[10px] text-on-surface-variant whitespace-nowrap">{result.subtitle}</div>
                  )}
                </div>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider flex-shrink-0">
                  {result.type}
                </span>
              </button>
            ))}

            {searchQuery.length < 2 && !searchLoading && (
              <p className="px-4 py-3 text-xs text-on-surface-variant text-center">
                Type 2+ characters to search
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketChip({
  market,
  color,
  onRemove,
}: {
  market: MyMarket;
  color: 'primary' | 'comparison';
  onRemove: () => void;
}) {
  const colors = color === 'primary'
    ? 'bg-primary-container text-on-primary-container'
    : 'bg-secondary-container text-on-secondary-container';

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm ${colors}`}>
      <span className="font-medium truncate max-w-[140px]">{market.name}</span>
      <button
        onClick={onRemove}
        className="p-0.5 rounded-full hover:bg-on-surface/10 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default MarketSearchBar;
