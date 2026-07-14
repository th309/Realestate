"use client";

/**
 * TopMarketsList
 *
 * Displays top 10 market matches from the user's quiz preferences.
 * Free users see the top 3; items 4-10 are blurred with an upgrade CTA.
 * Each row shows rank, market name, match score ring, and a view link.
 */

import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { useTopMarketMatches, type MatchScoreResult } from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import { MarketInsightLine } from "./MarketInsightLine";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREE_TIER_VISIBLE_COUNT = 3;

// ---------------------------------------------------------------------------
// Mini score ring (compact match score visualization)
// ---------------------------------------------------------------------------

function MiniScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(score / 100, 1);
  const dashOffset = circumference * (1 - percentage);
  const color = getScoreColor(score);

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-gray-200, #e5e7eb)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-on-surface">
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single market row
// ---------------------------------------------------------------------------

interface MarketRowProps {
  match: MatchScoreResult;
  rank: number;
  archetypeId: string | null;
}

function MarketRow({ match, rank, archetypeId }: MarketRowProps) {
  const mapUrl = `/map?geo=metro&id=${encodeURIComponent(match.regionId)}&name=${encodeURIComponent(match.regionName)}`;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-outline-variant/50 last:border-b-0">
      {/* Rank */}
      <span className="w-6 text-center text-sm font-bold text-on-surface-variant">
        {rank}
      </span>

      {/* Score ring */}
      <MiniScoreRing score={match.matchScore} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-on-surface truncate">
          {match.regionName}
        </p>
        <MarketInsightLine
          regionId={match.regionId}
          archetypeId={archetypeId}
        />
      </div>

      {/* View link */}
      <Link
        href={mapUrl}
        className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        View
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blurred placeholder row (for gated items)
// ---------------------------------------------------------------------------

function BlurredMarketRow({ rank }: { rank: number }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-outline-variant/50 last:border-b-0 blur-sm select-none pointer-events-none">
      <span className="w-6 text-center text-sm font-bold text-on-surface-variant">
        {rank}
      </span>
      <div className="w-10 h-10 rounded-full bg-surface-container-highest" />
      <div className="flex-1 min-w-0">
        <div className="h-4 w-40 bg-surface-container-highest rounded" />
        <div className="h-3 w-56 bg-surface-container-highest rounded mt-1" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TopMarketsListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-3 border-b border-outline-variant/50 last:border-b-0 animate-pulse"
        >
          <div className="w-6 h-4 bg-surface-container-highest rounded" />
          <div className="w-10 h-10 rounded-full bg-surface-container-highest" />
          <div className="flex-1 min-w-0">
            <div className="h-4 w-32 bg-surface-container-highest rounded" />
            <div className="h-3 w-48 bg-surface-container-highest rounded mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface TopMarketsListProps {
  archetypeId: string | null;
}

export function TopMarketsList({ archetypeId }: TopMarketsListProps) {
  const { matches, isLoading } = useTopMarketMatches({
    geoLevel: "metro",
    limit: 10,
  });
  const { tier, loading: entitlementsLoading } = useEntitlements();
  const isFree = !entitlementsLoading && tier === "free";

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-5">
      <h2 className="text-lg font-medium text-on-surface mb-1">
        Top Market Matches
      </h2>
      <p className="text-xs text-on-surface-variant mb-4">
        Markets ranked by how well they match your preferences
      </p>

      {isLoading ? (
        <TopMarketsListSkeleton />
      ) : matches.length === 0 ? (
        <EmptyTopMarkets />
      ) : (
        <div>
          {/* Visible rows */}
          {matches
            .slice(0, isFree ? FREE_TIER_VISIBLE_COUNT : 10)
            .map((match, index) => (
              <MarketRow
                key={match.regionId}
                match={match}
                rank={index + 1}
                archetypeId={archetypeId}
              />
            ))}

          {/* Blurred rows for free users */}
          {isFree && matches.length > FREE_TIER_VISIBLE_COUNT && (
            <div className="relative mt-1">
              {matches.slice(FREE_TIER_VISIBLE_COUNT, 10).map((_, index) => (
                <BlurredMarketRow
                  key={index}
                  rank={FREE_TIER_VISIBLE_COUNT + index + 1}
                />
              ))}
              {/* Overlay upgrade CTA */}
              <div className="absolute inset-0 flex items-center justify-center bg-surface/60 backdrop-blur-[1px] rounded-lg">
                <div className="text-center">
                  <Lock className="w-5 h-5 text-on-surface-variant/60 mx-auto mb-2" />
                  <p className="text-sm font-medium text-on-surface mb-1">
                    Unlock all 10 matches
                  </p>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Upgrade to Pro
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyTopMarkets() {
  return (
    <div className="text-center py-8">
      <p className="text-sm font-medium text-on-surface">
        No matches found yet
      </p>
      <p className="text-xs text-on-surface-variant mt-1">
        Complete your profile to see personalized market matches.
      </p>
      <Link
        href="/onboarding"
        className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        Take the Quiz
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
