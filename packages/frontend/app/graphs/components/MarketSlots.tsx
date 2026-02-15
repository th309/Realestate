'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { MyMarket } from '../hooks/useMyMarkets';
import { useUniversalSearch } from '@/app/shared/hooks/useUniversalSearch';

/** Chart line colors — slots use these to indicate which line belongs to which market */
const SLOT_COLORS = ['#0891b2', '#3b82f6', '#ea580c'] as const;

interface MarketSlotsProps {
  markets: MyMarket[];
  maxSlots: number;
  onAdd: (market: MyMarket) => void;
  onRemove: (index: number) => void;
  className?: string;
}

export function MarketSlots({
  markets,
  maxSlots,
  onAdd,
  onRemove,
  className = '',
}: MarketSlotsProps) {
  const [searchingSlot, setSearchingSlot] = useState<number | null>(null);

  const canAddMore = markets.length < maxSlots;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {/* Filled market slots */}
      {markets.map((market, index) => (
        <FilledSlot
          key={market.id}
          market={market}
          color={SLOT_COLORS[index] || SLOT_COLORS[0]}
          onRemove={() => onRemove(index)}
        />
      ))}

      {/* Empty "Add Market" slot (only if below maxSlots) */}
      {canAddMore && (
        <AddSlot
          isSearching={searchingSlot !== null}
          onOpenSearch={() => setSearchingSlot(markets.length)}
          onCloseSearch={() => setSearchingSlot(null)}
          onSelect={(market) => {
            onAdd(market);
            setSearchingSlot(null);
          }}
          existingIds={markets.map((m) => m.id)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Filled Slot ───────────────────────── */

function FilledSlot({
  market,
  color,
  onRemove,
}: {
  market: MyMarket;
  color: string;
  onRemove: () => void;
}) {
  return (
    <div
      className="group flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-surface-container text-on-surface transition-colors hover:bg-surface-container-high"
    >
      {/* Color dot matching chart line */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Market name */}
      <span className="flex-1 min-w-0 text-xs font-medium truncate">
        {market.name}
      </span>

      {/* Geo type badge */}
      <span className="text-[9px] text-on-surface-variant/60 uppercase tracking-wider flex-shrink-0">
        {market.type}
      </span>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-0.5 rounded-full text-on-surface-variant/50 opacity-0 group-hover:opacity-100 hover:text-on-surface hover:bg-on-surface/10 transition-all"
        title={`Remove ${market.name}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ───────────────────────── Add Slot ───────────────────────── */

function AddSlot({
  isSearching,
  onOpenSearch,
  onCloseSearch,
  onSelect,
  existingIds,
}: {
  isSearching: boolean;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onSelect: (market: MyMarket) => void;
  existingIds: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    handleSearch,
    clearSearch,
  } = useUniversalSearch({});

  // Focus input when search opens
  useEffect(() => {
    if (isSearching && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearching]);

  // Close search on outside click
  useEffect(() => {
    if (!isSearching) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCloseSearch();
        clearSearch();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSearching, onCloseSearch, clearSearch]);

  const handleSelectResult = (result: any) => {
    const geoType = result.type === 'metro'
      ? 'metro'
      : result.type === 'county'
        ? 'county'
        : result.type === 'zip'
          ? 'zip'
          : 'metro';

    const market: MyMarket = {
      id: result.id,
      name: result.name,
      type: geoType as 'metro' | 'county' | 'zip',
      state: result.state,
      score: null,
    };

    onSelect(market);
    clearSearch();
  };

  // Filter out markets that are already selected
  const filteredResults = searchResults.filter(
    (r) => !existingIds.includes(r.id)
  );

  if (!isSearching) {
    return (
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-dashed border-outline-variant/40 text-on-surface-variant/60 hover:border-primary/40 hover:text-primary hover:bg-primary-container/10 transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Add Market</span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Inline search input */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-primary/50 bg-surface-container-lowest ring-1 ring-primary/20">
        <Search className="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search market..."
          className="flex-1 min-w-0 bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/50 outline-none"
        />
        <button
          onClick={() => {
            onCloseSearch();
            clearSearch();
          }}
          className="p-0.5 rounded text-on-surface-variant hover:text-on-surface"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Search results dropdown */}
      {(showSearchResults || searchLoading) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 z-50 overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {searchLoading && (
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] text-on-surface-variant">Searching...</span>
              </div>
            )}

            {!searchLoading && filteredResults.length === 0 && searchQuery.length >= 2 && (
              <p className="px-3 py-2.5 text-[11px] text-on-surface-variant text-center">
                No markets found
              </p>
            )}

            {filteredResults.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelectResult(result)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-container transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-on-surface truncate">{result.name}</div>
                  {result.subtitle && (
                    <div className="text-[9px] text-on-surface-variant">{result.subtitle}</div>
                  )}
                </div>
                <span className="text-[9px] text-on-surface-variant uppercase tracking-wider flex-shrink-0">
                  {result.type}
                </span>
              </button>
            ))}

            {searchQuery.length < 2 && !searchLoading && (
              <p className="px-3 py-2.5 text-[11px] text-on-surface-variant text-center">
                Type 2+ characters to search
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketSlots;
