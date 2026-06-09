"use client";

/**
 * WatchlistUpdates
 *
 * Shows the user's saved watchlist items with score information.
 * If no watchlist exists, prompts the user to add markets.
 *
 * Uses the useWatchlist hook from lib/watchlist
 * and reuses the WatchlistDashboard display component.
 */

import Link from "next/link";
import { Bookmark, ChevronRight, MapPin } from "lucide-react";
import { useWatchlist } from "@/lib/watchlist/useWatchlist";
import { WatchlistDashboard } from "@/components/watchlist/WatchlistDashboard";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WatchlistUpdatesProps {
  userId: string;
}

export function WatchlistUpdates({ userId }: WatchlistUpdatesProps) {
  const { items, isLoading } = useWatchlist({ userId, autoLoad: true });

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-medium text-on-surface">
            Watchlist Updates
          </h2>
        </div>
        {items.length > 0 && (
          <span className="text-xs text-on-surface-variant">
            {items.length} market{items.length !== 1 ? "s" : ""} saved
          </span>
        )}
      </div>
      <p className="text-xs text-on-surface-variant mb-4">
        Score changes for your saved markets
      </p>

      {!isLoading && items.length === 0 ? (
        <EmptyWatchlist />
      ) : (
        <WatchlistDashboard items={items} isLoading={isLoading} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyWatchlist() {
  return (
    <div className="text-center py-8">
      <MapPin className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-3" />
      <p className="text-sm font-medium text-on-surface">
        No markets saved yet
      </p>
      <p className="text-xs text-on-surface-variant mt-1">
        Explore markets on the map and tap the bookmark icon to save them here.
      </p>
      <Link
        href="/map"
        className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        Explore Markets
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
