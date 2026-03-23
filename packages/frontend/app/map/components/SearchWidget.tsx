"use client";

import { useState } from "react";
import Link from "next/link";
import {
  SearchIcon,
  LocationPinIcon,
  MailboxIcon,
  BuildingIcon,
  MetroIcon,
} from "./Icons";
import type { SearchResult } from "../types";
import { trackEvent } from "@/lib/analytics/tracker";
import { useWatchlist, type WatchlistItem } from "@/lib/data";
import { useAuth } from "@/lib/auth";

const SUPPORTED_GEO_TYPES = ["metro", "county", "zip"];

/** Convert a watchlist item to SearchResult so consumers don't need changes */
function watchlistToSearchResult(item: WatchlistItem): SearchResult {
  return {
    id: item.geography_id,
    name: item.geography_name,
    type: item.geography_type as SearchResult["type"],
    subtitle:
      item.geography_type === "zip"
        ? "ZIP Code"
        : item.geography_type === "metro"
          ? "Metro Area"
          : item.geography_type === "county"
            ? "County"
            : undefined,
  };
}

interface SearchWidgetProps {
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  showSearchResults: boolean;
  searchRef: React.RefObject<HTMLDivElement | null>;
  onSearch: (query: string) => void;
  onSelectResult: (result: SearchResult) => void;
  onFocus: () => void;
  className?: string;
  placeholder?: string;
  /** Set to false to hide the favorites section (default: true) */
  showFavorites?: boolean;
}

export function SearchWidget({
  searchQuery,
  searchResults,
  searchLoading,
  showSearchResults,
  searchRef,
  onSearch,
  onSelectResult,
  onFocus,
  className,
  placeholder = "Search city, zip, or county",
  showFavorites = true,
}: SearchWidgetProps) {
  const [focused, setFocused] = useState(false);
  const { user } = useAuth();
  const { favorites, isLoading: favoritesLoading } = useWatchlist();

  // Filter favorites to supported geo types + search query
  const filteredFavorites = showFavorites
    ? favorites
        .filter((f) => SUPPORTED_GEO_TYPES.includes(f.geography_type))
        .filter(
          (f) =>
            !searchQuery ||
            f.geography_name.toLowerCase().includes(searchQuery.toLowerCase()),
        )
    : [];

  const hasFavoritesToShow =
    showFavorites &&
    (filteredFavorites.length > 0 || favoritesLoading || !user);
  const hasSearchResults = searchResults.length > 0;

  // Show dropdown when search results exist OR when focused with favorites enabled
  // (FavoritesInDropdown always renders content: sign-in CTA, skeleton, empty state, or list)
  const dropdownVisible = showSearchResults || (focused && showFavorites);

  return (
    <div
      className={className ?? "flex-1 max-w-2xl mx-0 md:mx-8"}
      ref={searchRef}
    >
      <div className="relative">
        <div className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
          <SearchIcon />
        </div>
        {/* M3 Search Bar: h-14 (56px), rounded-full, bg-surface-container-high */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => {
            setFocused(true);
            onFocus();
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchResults.length > 0) {
              trackEvent("feature.search", {
                query: searchQuery,
                result_type: searchResults[0].type,
                result_name: searchResults[0].name,
              });
              onSelectResult(searchResults[0]);
              e.currentTarget.blur();
            }
          }}
          placeholder={placeholder}
          className="w-full h-14 pl-10 md:pl-12 pr-3 md:pr-4 bg-surface-container-high rounded-full text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-200"
        />
        {/* Search Results Dropdown - M3 Menu styling */}
        {dropdownVisible && (
          <div
            onMouseDown={(e) => e.preventDefault()}
            className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-xl elevation-2 border border-outline-variant overflow-hidden z-50 max-h-80 overflow-y-auto"
          >
            {/* Favorites Section */}
            {showFavorites && (
              <FavoritesInDropdown
                user={user}
                loading={favoritesLoading}
                favorites={filteredFavorites}
                searchQuery={searchQuery}
                onSelect={(item) => {
                  trackEvent("feature.search", {
                    query: "favorite",
                    result_type: item.geography_type,
                    result_name: item.geography_name,
                  });
                  onSelectResult(watchlistToSearchResult(item));
                }}
              />
            )}

            {/* Search Results Divider */}
            {hasFavoritesToShow && hasSearchResults && (
              <div className="px-4 py-1.5 text-[10px] font-medium text-on-surface-variant uppercase tracking-wider bg-surface-container/30">
                Search Results
              </div>
            )}

            {/* Search Results */}
            {searchLoading ? (
              <div className="px-4 py-3 text-sm text-on-surface-variant flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-container border-t-primary rounded-full animate-spin"></div>
                Searching...
              </div>
            ) : hasSearchResults ? (
              <ul>
                {searchResults.map((result) => (
                  <li key={result.id}>
                    <button
                      onClick={() => {
                        trackEvent("feature.search", {
                          query: searchQuery,
                          result_type: result.type,
                          result_name: result.name,
                        });
                        onSelectResult(result);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-surface-container flex items-center gap-3 transition-colors duration-200"
                    >
                      <span className="text-on-surface-variant">
                        {result.type === "state" ? (
                          <LocationPinIcon />
                        ) : result.type === "zip" ? (
                          <MailboxIcon />
                        ) : result.type === "metro" ? (
                          <MetroIcon />
                        ) : (
                          <BuildingIcon />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-on-surface truncate">
                          {result.name}
                        </div>
                        <div className="text-xs text-on-surface-variant">
                          {result.subtitle || (
                            <span className="capitalize">{result.type}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : searchQuery.length >= 2 ? (
              <div className="px-4 py-3 text-sm text-on-surface-variant">
                No results found
              </div>
            ) : !hasFavoritesToShow ? null : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Favorites sub-component (keeps SearchWidget focused)
// ---------------------------------------------------------------------------

function FavoritesInDropdown({
  user,
  loading,
  favorites,
  searchQuery,
  onSelect,
}: {
  user: { id: string } | null;
  loading: boolean;
  favorites: WatchlistItem[];
  searchQuery: string;
  onSelect: (item: WatchlistItem) => void;
}) {
  if (!user) {
    return (
      <div className="px-4 py-2.5 border-b border-outline-variant/20">
        <Link
          href="/auth/login"
          className="flex items-center gap-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span>Save your favorite markets</span>
          <span className="text-primary font-medium">Sign in</span>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-3 border-b border-outline-variant/20">
        <div className="h-4 w-48 rounded bg-surface-container animate-pulse" />
      </div>
    );
  }

  if (favorites.length === 0 && !searchQuery) {
    return (
      <div className="px-4 py-2.5 border-b border-outline-variant/20">
        <Link
          href="/map"
          className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
        >
          No favorites yet —{" "}
          <span className="text-primary font-medium">
            add markets from the map
          </span>
        </Link>
      </div>
    );
  }

  if (favorites.length === 0) return null;

  return (
    <div className="border-b border-outline-variant/20">
      <div className="px-4 pt-2 pb-1">
        <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">
          Your Favorites
        </span>
      </div>
      {favorites.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className="w-full px-4 py-2.5 text-left hover:bg-surface-container flex items-center gap-3 transition-colors duration-200"
        >
          <span className="text-on-surface-variant">
            {item.geography_type === "zip" ? (
              <MailboxIcon />
            ) : item.geography_type === "metro" ? (
              <MetroIcon />
            ) : (
              <BuildingIcon />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-on-surface truncate">
              {item.geography_name}
            </div>
            <div className="text-xs text-on-surface-variant capitalize">
              {item.geography_type === "zip" ? "ZIP Code" : item.geography_type}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
