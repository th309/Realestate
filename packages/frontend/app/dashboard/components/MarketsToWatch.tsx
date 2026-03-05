"use client";

/**
 * MarketsToWatch
 *
 * Shows markets from the lower portion of the user's top matches
 * as "trending" opportunities. These are markets that match the user's
 * profile but are ranked lower — worth monitoring for improvement.
 *
 * Uses the bottom 3-5 of the top 10 matches from useTopMarketMatches.
 * Can be enhanced later when historical match data is available.
 */

import Link from "next/link";
import { TrendingUp, ChevronRight, Eye } from "lucide-react";
import { useTopMarketMatches, type MatchScoreResult } from "@/lib/data";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** We treat matches ranked 6-10 as "ones to watch" */
const WATCH_START_INDEX = 5;
const WATCH_COUNT = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MarketsToWatch() {
  const { matches, isLoading } = useTopMarketMatches({
    geoLevel: "metro",
    limit: 10,
  });

  const watchMarkets = matches.slice(
    WATCH_START_INDEX,
    WATCH_START_INDEX + WATCH_COUNT,
  );

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <Eye className="w-4 h-4 text-primary" />
        <h2 className="text-lg font-medium text-on-surface">
          Markets to Watch
        </h2>
      </div>
      <p className="text-xs text-on-surface-variant mb-4">
        Emerging matches worth monitoring
      </p>

      {isLoading ? (
        <WatchListSkeleton />
      ) : watchMarkets.length === 0 ? (
        <EmptyWatchList />
      ) : (
        <div className="space-y-2">
          {watchMarkets.map((market) => (
            <WatchMarketCard key={market.regionId} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual card
// ---------------------------------------------------------------------------

function WatchMarketCard({ market }: { market: MatchScoreResult }) {
  const mapUrl = `/map?geo=metro&id=${encodeURIComponent(market.regionId)}&name=${encodeURIComponent(market.regionName)}`;
  const color = getScoreColor(market.matchScore);

  return (
    <Link
      href={mapUrl}
      className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant/50 hover:bg-surface-container hover:shadow-sm transition-all group"
    >
      {/* Score indicator dot */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-on-surface truncate">
          {market.regionName}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          <span className="text-[11px] text-on-surface-variant">
            Match score: {Math.round(market.matchScore)}
          </span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-on-surface-variant/40 group-hover:text-on-surface-variant flex-shrink-0" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function WatchListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant/50 animate-pulse"
        >
          <div className="w-3 h-3 rounded-full bg-surface-container-highest" />
          <div className="flex-1">
            <div className="h-4 w-28 bg-surface-container-highest rounded" />
            <div className="h-3 w-20 bg-surface-container-highest rounded mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyWatchList() {
  return (
    <div className="text-center py-6">
      <TrendingUp className="w-6 h-6 text-on-surface-variant/30 mx-auto mb-2" />
      <p className="text-sm text-on-surface-variant">
        Not enough matches yet to suggest markets to watch.
      </p>
    </div>
  );
}
