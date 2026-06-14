"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { fetchGeographySearch } from "@/lib/data";
import type { GeographySearchResult } from "@/lib/data/fetchers/search";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeographySelection {
  id: string;
  name: string;
  geoLevel: string;
}

interface GeographySearchProps {
  onSelect: (result: GeographySelection) => void;
  /** Optional: restrict results to one geography level (metro, county, zip, state) */
  geoLevelFilter?: string;
  placeholder?: string;
  /** Controlled display value — shown in the input when a selection exists */
  value?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;

const GEO_LEVEL_LABELS: Record<string, string> = {
  metro: "Metro",
  county: "County",
  zip: "ZIP",
  state: "State",
  city: "City",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GeographySearch({
  onSelect,
  geoLevelFilter,
  placeholder = "Search for a location...",
  value,
}: GeographySearchProps) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<GeographySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync controlled value prop into input when it changes externally
  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const executeSearch = useCallback(
    async (searchQuery: string) => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (searchQuery.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setDropdownOpen(false);
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setDropdownOpen(true);

      try {
        const geographies = await fetchGeographySearch(searchQuery, {
          type: geoLevelFilter,
          limit: MAX_RESULTS,
          signal: controller.signal,
        });
        setResults(geographies.slice(0, MAX_RESULTS));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[GeographySearch] Error:", err);
        }
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [geoLevelFilter],
  );

  function handleInputChange(inputValue: string) {
    setQuery(inputValue);

    // Clear pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (inputValue.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setDropdownOpen(false);
      setLoading(false);
      return;
    }

    // Show loading immediately for responsiveness, search after debounce
    setLoading(true);
    setDropdownOpen(true);

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(inputValue);
    }, DEBOUNCE_MS);
  }

  function handleSelect(geography: GeographySearchResult) {
    const selection: GeographySelection = {
      id: geography.geography_id,
      name: geography.name,
      geoLevel: geography.geography_type,
    };

    setQuery(geography.name);
    setDropdownOpen(false);
    setResults([]);
    onSelect(selection);
  }

  const showNoResults =
    dropdownOpen &&
    !loading &&
    results.length === 0 &&
    query.length >= MIN_QUERY_LENGTH;

  const showResults = dropdownOpen && (loading || results.length > 0);

  return (
    <div ref={containerRef} className="relative">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (query.length >= MIN_QUERY_LENGTH && results.length > 0) {
              setDropdownOpen(true);
            }
          }}
          placeholder={placeholder}
          className="w-full h-12 pl-10 pr-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-200"
        />
      </div>

      {/* Dropdown */}
      {(showResults || showNoResults) && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full left-0 right-0 mt-1 bg-surface shadow-lg rounded-xl border border-outline-variant overflow-hidden z-50 max-h-72 overflow-y-auto"
        >
          {loading ? (
            <div className="px-4 py-3 text-sm text-on-surface-variant flex items-center gap-2">
              <LoadingSpinner />
              <span>Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <ul>
              {results.map((geography) => (
                <li
                  key={`${geography.geography_type}-${geography.geography_id}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(geography)}
                    className="w-full px-4 py-3 text-left hover:bg-surface-container flex items-center justify-between gap-3 transition-colors duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-on-surface truncate">
                        {geography.name}
                      </div>
                      {geography.cbsa_name &&
                        geography.geography_type === "county" && (
                          <div className="text-xs text-on-surface-variant truncate">
                            {geography.cbsa_name}
                          </div>
                        )}
                    </div>
                    <span className="rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5 font-medium shrink-0">
                      {GEO_LEVEL_LABELS[geography.geography_type] ??
                        geography.geography_type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {showNoResults && (
            <div className="px-4 py-3 text-sm text-on-surface-variant">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal SVG icons (avoids importing from map-specific icon set)
// ---------------------------------------------------------------------------

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <div className="w-4 h-4 border-2 border-primary-container border-t-primary rounded-full animate-spin" />
  );
}
