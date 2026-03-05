"use client";

import React from "react";
import Link from "next/link";
import { MapPin, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { UserTier } from "@/lib/entitlements";

interface WatchlistItem {
  id: string;
  geography_type: string;
  geography_id: string;
  geography_name: string;
  added_at: string;
  score_at_add: number | null;
}

interface SavedMarketsSectionProps {
  items: WatchlistItem[];
  isLoading: boolean;
  tier: UserTier;
}

const WATCHLIST_LIMITS: Record<UserTier, number> = {
  free: 3,
  pro: 10,
  enterprise: 25,
  admin: -1,
};

function getTrendIndicator(scoreAtAdd: number | null) {
  if (scoreAtAdd == null)
    return { icon: Minus, color: "text-on-surface-variant", label: "No data" };
  // Simulated trend — in production this would compare score_at_add to current score
  // For now just show a neutral indicator
  return { icon: Minus, color: "text-amber-500", label: "Stable" };
}

export function SavedMarketsSection({
  items,
  isLoading,
  tier,
}: SavedMarketsSectionProps) {
  const limit = WATCHLIST_LIMITS[tier];
  const isUnlimited = limit === -1;

  return (
    <section className="bg-white rounded-xl border border-purple-200/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#7C3AED]" />
          <h2 className="text-lg font-semibold text-on-surface">
            Saved Markets
          </h2>
        </div>
        <span className="text-sm text-on-surface-variant">
          {items.length}
          {isUnlimited ? "" : ` of ${limit}`} used
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-surface-container-highest rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center">
          <MapPin className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-3" />
          <p className="text-sm font-medium text-on-surface">
            No saved markets yet
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            Save markets from the map to track them here.
          </p>
          <Link
            href="/map"
            className="inline-flex mt-4 px-4 py-2 bg-[#7C3AED] text-white rounded-lg text-sm font-medium hover:bg-[#7C3AED]/90 transition-colors"
          >
            Explore Markets
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const trend = getTrendIndicator(item.score_at_add);
            const TrendIcon = trend.icon;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant hover:border-[#7C3AED]/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
                    {item.score_at_add != null ? (
                      <span className="text-sm font-bold text-[#7C3AED]">
                        {Math.round(item.score_at_add)}
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant">
                        --
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">
                      {item.geography_name}
                    </p>
                    <p className="text-xs text-on-surface-variant capitalize">
                      {item.geography_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <TrendIcon className={`w-4 h-4 ${trend.color}`} />
                  <Link
                    href={`/map?geo=${item.geography_type}&id=${item.geography_id}&name=${encodeURIComponent(item.geography_name)}`}
                    className="text-xs font-medium text-[#7C3AED] hover:text-[#7C3AED]/80 transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
