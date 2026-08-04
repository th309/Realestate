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

/** The three levels the PropertyIQ Score is computed at. */
const SCORED_LEVELS = ["metro", "county", "zip"] as const;
type ScoredLevel = (typeof SCORED_LEVELS)[number];

interface SidebarScoreCardProps {
  /** Single PropertyIQ score */
  score?: ScoreInfo;
  isLoading?: boolean;
  onClick?: () => void;
  onUpgradeClick?: () => void;
  /** Current map geography. State has no score — see the empty state below. */
  geoLevel?: string;
  /** Switches the map to a scored level from the state-level message. */
  onGeoLevelChange?: (level: ScoredLevel) => void;
}

export function SidebarScoreCard({
  score: currentScore,
  isLoading = false,
  onClick,
  onUpgradeClick,
  geoLevel,
  onGeoLevelChange,
}: SidebarScoreCardProps) {
  const hasScore = currentScore?.score !== undefined && !isLoading;
  const isBreakdownLocked = currentScore?.access === "teaser";
  const isStateLevel = geoLevel === "state";

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
          ) : isStateLevel ? (
            // There is no state-level PropertyIQ Score. The geography enum is
            // metro, county and ZIP; 50 is the calibration point AGAINST a
            // state average, not a score a state holds (CLAUDE.md section 9).
            // "Select a region to see scores" was misleading here — a user can
            // click every state and never get one.
            <div>
              <p className="text-xs text-on-surface-variant">
                Scored at metro, county, and ZIP — not at state level.
              </p>
              {onGeoLevelChange && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {SCORED_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGeoLevelChange(level);
                      }}
                      className="rounded-full border border-outline-variant px-2 py-0.5 text-[11px] font-semibold capitalize text-primary transition-colors hover:bg-primary-container"
                    >
                      {level === "zip" ? "ZIP" : level}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
