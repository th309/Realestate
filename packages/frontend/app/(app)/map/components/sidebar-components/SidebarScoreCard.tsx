/**
 * SidebarScoreCard Component
 *
 * Displays the single PropertyIQ Score at the top of the sidebar.
 *
 * Access control is driven entirely by entitlements (DB tier assignments).
 * The `access` field on the score ('full' | 'teaser') determines lock state.
 * No hardcoded tier gating — use the admin tiers page to move scores between tiers.
 */

import Link from "next/link";
import { InsightsIcon } from "../Icons";
import { TrendArrow, getTrendDirection, formatTrendValue } from "./TrendArrow";
import { ScoreDisplay } from "@/app/components/scoring/ScoreDisplay";
import { Loader2 } from "lucide-react";

interface ScoreInfo {
  score?: number;
  trend?: number; // Change from 3 months ago (e.g., +2.5 or -1.3)
  access: "full" | "teaser";
  /** Whether this score metric is gated by entitlements */
  gated?: boolean;
  /** Tier required to unlock (e.g. 'pro', 'enterprise') */
  tierRequired?: string;
}

interface SidebarScoreCardProps {
  /** Single PropertyIQ score */
  score?: ScoreInfo;
  isLoading?: boolean;
  onClick?: () => void;
  onUpgradeClick?: () => void;
}

export function SidebarScoreCard({
  score: currentScore,
  isLoading = false,
  onClick,
  onUpgradeClick,
}: SidebarScoreCardProps) {
  const hasScore = currentScore?.score !== undefined && !isLoading;
  const isBreakdownLocked = currentScore?.access === "teaser";

  // Show trend arrow only when we have real trend data from API (not when missing/no history)
  const trendDirection =
    currentScore?.trend !== undefined
      ? getTrendDirection(currentScore.trend)
      : "flat";
  const trendValue =
    currentScore?.trend !== undefined
      ? formatTrendValue(currentScore.trend, "points")
      : "\u2014";

  return (
    <div
      data-testid="sidebar-score-card"
      className={`
        bg-surface-container rounded-xl p-3 mb-4 border border-outline-variant
        ${onClick ? "cursor-pointer hover:bg-surface-container-high transition-colors duration-200" : ""}
      `}
      onClick={onClick}
    >
      {/* Header with score name */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-on-surface">
          <span className="w-5 h-5 text-on-surface-variant">
            <InsightsIcon />
          </span>
          <span
            data-testid="score-label-propertyiq"
            className="text-sm font-semibold"
          >
            PropertyIQ Score
          </span>
          {currentScore?.gated && currentScore.tierRequired && (
            <span
              data-testid="score-pro-badge-propertyiq"
              className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-primary text-on-primary rounded"
            >
              {currentScore.tierRequired}
            </span>
          )}
        </div>
        <Link
          href="/scores/methodology"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-[11px] text-primary hover:text-primary/80 transition-colors"
        >
          How it&apos;s scored
        </Link>
      </div>

      {/* Score Content */}
      <div className="flex items-start gap-3">
        {/* Score Display */}
        <div className="flex-shrink-0 relative">
          {isLoading ? (
            <div className="w-16 h-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
            </div>
          ) : hasScore ? (
            <ScoreDisplay
              value={currentScore.score!}
              size={64}
              strokeWidth={5}
              showLabel={false}
            />
          ) : (
            <div className="w-16 h-16 flex items-center justify-center rounded-full border-4 border-surface-container-highest">
              <span className="text-lg text-on-surface-variant">
                {"\u2014"}
              </span>
            </div>
          )}
        </div>

        {/* Score Details */}
        <div className="flex-1 min-w-0">
          {hasScore ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-on-surface-variant">
                  3-month change
                </span>
                <TrendArrow direction={trendDirection} value={trendValue} />
              </div>
              {isBreakdownLocked && (
                <button
                  data-testid="score-upgrade-cta-propertyiq"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpgradeClick?.();
                  }}
                  className="mt-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  See what drives this score →
                </button>
              )}
            </>
          ) : (
            <p className="text-xs text-on-surface-variant">
              Select a region to see scores
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
