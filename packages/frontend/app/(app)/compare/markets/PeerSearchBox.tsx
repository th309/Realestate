"use client";

import { useMemo } from "react";
import { useUniversalSearch } from "@/app/shared/hooks/useUniversalSearch";

// The comparison only supports the geographies the PropertyIQ score covers.
const VALID_GEOS = ["metro", "county", "zip"] as const;
type CompareGeo = (typeof VALID_GEOS)[number];

export interface PickedMarket {
  geoLevel: CompareGeo;
  geoId: string;
  name: string;
}

interface SearchResult {
  id: string;
  name: string;
  type: string;
  subtitle?: string;
}

/**
 * Compact M3 search box for choosing a market to compare. Reused for both the
 * empty-state source pick and the "compare against another market" peer
 * override, so the comparison never dead-ends without options.
 */
export function PeerSearchBox({
  placeholder,
  onPick,
}: {
  placeholder: string;
  onPick: (market: PickedMarket) => void;
}) {
  const { searchQuery, searchResults, searchLoading, handleSearch } =
    useUniversalSearch({});

  const visible = useMemo<Array<SearchResult & { type: CompareGeo }>>(
    () =>
      (searchResults as SearchResult[])
        .filter((r): r is SearchResult & { type: CompareGeo } =>
          (VALID_GEOS as readonly string[]).includes(r.type),
        )
        .slice(0, 6),
    [searchResults],
  );

  return (
    <div className="relative">
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border-2 border-outline-variant bg-white px-5 py-3 text-base shadow-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        aria-label={placeholder}
      />
      {visible.length > 0 && (
        <ul
          className="mt-2 overflow-hidden rounded-xl border border-outline-variant bg-white"
          role="listbox"
        >
          {visible.map((r) => (
            <li key={`${r.type}-${r.id}`} role="option" aria-selected="false">
              <button
                type="button"
                onClick={() => {
                  onPick({ geoLevel: r.type, geoId: r.id, name: r.name });
                  handleSearch(""); // clear so the listbox closes after a pick
                }}
                className="flex w-full items-center justify-between gap-4 border-b border-outline-variant/40 px-4 py-2.5 text-left last:border-b-0 hover:bg-primary-container/40"
              >
                <span className="truncate text-sm font-medium text-on-surface">
                  {r.name}
                </span>
                <span className="shrink-0 text-xs uppercase tracking-wide text-on-surface-variant">
                  {r.subtitle ?? r.type}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searchLoading && (
        <p className="mt-2 text-center text-xs text-on-surface-variant">
          Searching…
        </p>
      )}
    </div>
  );
}
