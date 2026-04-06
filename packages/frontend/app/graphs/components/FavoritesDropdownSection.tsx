"use client";

import React from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { MyMarket } from "../hooks/useMyMarkets";
import type { WatchlistItem } from "@/lib/data";

/** Capitalize first letter of a geo type for the badge display */
function geoTypeBadgeLabel(type: string): string {
  if (type === "zip") return "ZIP";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

interface FavoritesSectionProps {
  user: User | null;
  favoritesLoading: boolean;
  filteredFavorites: WatchlistItem[];
  searchQuery: string;
  onSelectMarket: (market: MyMarket) => void;
  onSelectAsPrimary?: (market: MyMarket) => void;
  onSelectAsComparison?: (market: MyMarket) => void;
}

function watchlistItemToMarket(item: WatchlistItem): MyMarket {
  return {
    id: item.geography_id,
    name: item.geography_name ?? item.geography_id,
    type: item.geography_type,
    score: item.score_at_add ?? null,
    isPinned: true,
  };
}

export function FavoritesSection({
  user,
  favoritesLoading,
  filteredFavorites,
  searchQuery,
  onSelectMarket,
  onSelectAsPrimary,
  onSelectAsComparison,
}: FavoritesSectionProps) {
  // Not authenticated
  if (!user) {
    return (
      <div className="px-4 py-2.5 border-b border-outline-variant/20">
        <Link
          href="/auth/sign-in"
          className="flex items-center gap-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span>Save your favorite markets</span>
          <span className="text-primary font-medium">Sign in</span>
        </Link>
      </div>
    );
  }

  // Loading
  if (favoritesLoading) {
    return (
      <div className="px-4 py-3 border-b border-outline-variant/20">
        <div className="h-4 w-48 rounded bg-surface-container animate-pulse" />
      </div>
    );
  }

  // No favorites (and not searching)
  if (filteredFavorites.length === 0 && !searchQuery) {
    return (
      <div className="px-4 py-2.5 border-b border-outline-variant/20">
        <Link
          href="/map"
          className="flex items-center gap-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span>No favorites yet — add markets from the map</span>
        </Link>
      </div>
    );
  }

  // No favorites match current search
  if (filteredFavorites.length === 0) {
    return null;
  }

  // Has favorites
  return (
    <div className="border-b border-outline-variant/20">
      <div className="px-4 pt-2 pb-1">
        <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">
          Your Favorites
        </span>
      </div>
      {filteredFavorites.map((item) => {
        const market = watchlistItemToMarket(item);
        return (
          <button
            key={item.id}
            onClick={() => onSelectMarket(market)}
            className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-surface-container transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <span className="text-sm text-on-surface truncate block">
                {market.name}
              </span>
            </div>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider flex-shrink-0 px-1.5 py-0.5 rounded bg-surface-container">
              {geoTypeBadgeLabel(item.geography_type)}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {onSelectAsPrimary && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAsPrimary(market);
                  }}
                  className="text-xs px-2 py-0.5 rounded-full bg-primary text-on-primary font-medium hover:bg-primary/90 transition-colors"
                >
                  Main
                </button>
              )}
              {onSelectAsComparison && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAsComparison(market);
                  }}
                  className="text-xs px-2 py-0.5 rounded-full border border-primary text-primary font-medium hover:bg-primary-container/30 transition-colors"
                >
                  Compare
                </button>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
