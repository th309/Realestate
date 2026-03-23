"use client";

import React from "react";
import Link from "next/link";
import { MyMarket } from "../hooks/useMyMarkets";
import type { WatchlistItem } from "@/lib/data";

/** Convert a watchlist item to the MyMarket shape used by the graphs page */
export function watchlistItemToMarket(item: WatchlistItem): MyMarket {
  return {
    id: item.geography_id,
    name: item.geography_name ?? item.geography_id,
    type: item.geography_type,
    score: item.score_at_add ?? null,
    isPinned: true,
  };
}

interface SlotFavoritesSectionProps {
  user: { id: string } | null;
  favoritesLoading: boolean;
  filteredFavorites: WatchlistItem[];
  searchQuery: string;
  onSelect: (market: MyMarket) => void;
}

/**
 * Compact favorites section rendered inside the MarketSlots add-market dropdown.
 *
 * States:
 * - Not authenticated: sign-in prompt
 * - Loading: skeleton row
 * - No favorites (no query): prompt to add from map
 * - Favorites filtered to zero by query: renders nothing
 * - Has favorites: header + clickable list items
 */
export function SlotFavoritesSection({
  user,
  favoritesLoading,
  filteredFavorites,
  searchQuery,
  onSelect,
}: SlotFavoritesSectionProps) {
  // Not signed in — prompt to sign in
  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="flex items-center gap-2 px-3 py-2.5 text-[11px] text-on-surface-variant hover:bg-surface-container transition-colors"
      >
        <span>&#11088;</span>
        <span>
          Save your favorite markets &middot;{" "}
          <span className="text-primary font-medium">Sign in</span>
        </span>
      </Link>
    );
  }

  // Loading skeleton
  if (favoritesLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="h-3 w-24 bg-on-surface/10 rounded animate-pulse" />
      </div>
    );
  }

  // No favorites (only show when user hasn't typed a search query)
  if (filteredFavorites.length === 0 && !searchQuery) {
    return (
      <Link
        href="/map"
        className="flex items-center gap-2 px-3 py-2.5 text-[11px] text-on-surface-variant hover:bg-surface-container transition-colors"
      >
        <span>&#11088;</span>
        <span>
          No favorites yet &mdash;{" "}
          <span className="text-primary font-medium">
            add markets from the map
          </span>
        </span>
      </Link>
    );
  }

  // No matches for current query
  if (filteredFavorites.length === 0) return null;

  // Render favorites list
  return (
    <>
      <div className="px-3 py-1.5 text-[9px] font-medium text-on-surface-variant/50 uppercase tracking-wider">
        &#11088; Your Favorites
      </div>
      {filteredFavorites.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(watchlistItemToMarket(item))}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-container transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="text-xs text-on-surface whitespace-nowrap">
              {item.geography_name ?? item.geography_id}
            </div>
          </div>
          <span className="text-[9px] text-on-surface-variant uppercase tracking-wider flex-shrink-0">
            {item.geography_type}
          </span>
        </button>
      ))}
    </>
  );
}
