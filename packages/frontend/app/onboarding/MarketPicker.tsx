"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { fetchGeographySearch } from "@/lib/data/fetchers/search";
import type { GeographySearchResult } from "@/lib/data/fetchers/search";

interface SelectedMarket {
  geoLevel: string;
  geoId: string;
  name: string;
}

interface MarketPickerProps {
  selectedMarkets: SelectedMarket[];
  onAdd: (market: SelectedMarket) => void;
  onRemove: (geoId: string) => void;
  maxSelections?: number;
}

const MAX_MARKETS_DEFAULT = 3;

export function MarketPicker({
  selectedMarkets,
  onAdd,
  onRemove,
  maxSelections = MAX_MARKETS_DEFAULT,
}: MarketPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeographySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const atLimit = selectedMarkets.length >= maxSelections;

  const searchMarkets = useCallback(
    async (searchQuery: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (searchQuery.length < 2) {
        setResults([]);
        setShowDropdown(false);
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsSearching(true);

      try {
        const data = await fetchGeographySearch(searchQuery, {
          limit: 8,
          signal: controller.signal,
        });

        const selectedIds = new Set(selectedMarkets.map((m) => m.geoId));
        const filtered = data.filter((r) => !selectedIds.has(r.geography_id));
        setResults(filtered);
        setShowDropdown(filtered.length > 0);
      } catch {
        // Aborted or failed — ignore
      } finally {
        setIsSearching(false);
      }
    },
    [selectedMarkets],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        searchMarkets(value);
      }, 250);
    },
    [searchMarkets],
  );

  const handleSelect = useCallback(
    (result: GeographySearchResult) => {
      const displayName = result.state_code
        ? `${result.name}, ${result.state_code}`
        : result.name;

      onAdd({
        geoLevel: result.geography_type,
        geoId: result.geography_id,
        name: displayName,
      });

      setQuery("");
      setResults([]);
      setShowDropdown(false);
      inputRef.current?.focus();
    },
    [onAdd],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={
            atLimit
              ? `Maximum ${maxSelections} markets selected`
              : "Search cities, metros, or ZIP codes..."
          }
          disabled={atLimit}
          className="w-full h-12 px-4 bg-surface border-2 border-outline-variant rounded-xl text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
          </div>
        )}

        {/* Results dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute z-10 mt-1 w-full bg-surface-container-high rounded-xl shadow-lg border border-outline-variant overflow-hidden"
          >
            {results.map((result) => (
              <button
                key={`${result.geography_type}-${result.geography_id}`}
                onClick={() => handleSelect(result)}
                className="w-full px-4 py-3 text-left hover:bg-primary/8 text-on-surface transition-colors duration-200 flex items-center justify-between"
              >
                <span className="text-sm font-medium">
                  {result.state_code
                    ? `${result.name}, ${result.state_code}`
                    : result.name}
                </span>
                <span className="text-xs text-on-surface-variant capitalize">
                  {result.geography_type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected market chips */}
      {selectedMarkets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedMarkets.map((market) => (
            <div
              key={market.geoId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/8 text-primary rounded-full text-sm font-medium"
            >
              <span>{market.name}</span>
              <button
                onClick={() => onRemove(market.geoId)}
                className="ml-0.5 p-0.5 rounded-full hover:bg-primary/16 transition-colors duration-200"
                aria-label={`Remove ${market.name}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Helper text */}
      <p className="text-xs text-on-surface-variant">
        {selectedMarkets.length} of {maxSelections} markets selected
        {selectedMarkets.length === 0 && " — you can add these later too"}
      </p>
    </div>
  );
}
