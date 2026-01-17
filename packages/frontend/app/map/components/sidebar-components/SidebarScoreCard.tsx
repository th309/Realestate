/**
 * SidebarScoreCard Component
 *
 * Displays at the top of the sidebar showing the overall market score.
 * Shows different scores based on view mode:
 * - Homebuyer: HomeReady Score
 * - Investor: InvestorEdge Score
 *
 * Features:
 * - Large score number with ring visualization
 * - Score interpretation text ("Good Time to Buy")
 * - Market condition badge (Buyer's/Seller's/Balanced)
 * - Trend indicator
 * - Data-driven summary text
 */

import type { ViewMode } from '../../types';
import { InsightsIcon } from '../Icons';
import { TrendArrow, TrendDirection } from './TrendArrow';
import { MarketConditionBadge, MarketCondition } from './MarketConditionBadge';

interface SidebarScoreCardProps {
  viewMode: ViewMode;
  score?: number; // 0-100
  scoreTrend?: {
    direction: TrendDirection;
    value: string;
  };
  marketCondition?: MarketCondition;
  summaryText?: string;
  isLoading?: boolean;
  onClick?: () => void;
}

/**
 * Get score interpretation text based on score value
 */
function getScoreInterpretation(score: number, viewMode: ViewMode): string {
  const isHomebuyer = viewMode === 'homebuyer';

  if (score >= 80) {
    return isHomebuyer ? 'Excellent Time to Buy' : 'Strong Investment';
  }
  if (score >= 60) {
    return isHomebuyer ? 'Good Time to Buy' : 'Good Opportunity';
  }
  if (score >= 40) {
    return isHomebuyer ? 'Fair Conditions' : 'Moderate Potential';
  }
  if (score >= 20) {
    return isHomebuyer ? 'Challenging Market' : 'Higher Risk';
  }
  return isHomebuyer ? 'Difficult Conditions' : 'Caution Advised';
}

/**
 * Get score color based on value
 */
function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-rose-600';
}

/**
 * Get ring color based on score
 */
function getRingColor(score: number): string {
  if (score >= 70) return 'stroke-emerald-500';
  if (score >= 40) return 'stroke-amber-500';
  return 'stroke-rose-500';
}

export function SidebarScoreCard({
  viewMode,
  score,
  scoreTrend,
  marketCondition = 'balanced',
  summaryText,
  isLoading = false,
  onClick,
}: SidebarScoreCardProps) {
  const scoreName = viewMode === 'homebuyer' ? 'HomeReady' : 'InvestorEdge';
  const hasScore = score !== undefined && !isLoading;

  return (
    <div
      className={`
        bg-surface-container rounded-xl p-3 mb-4 border border-outline-variant
        ${onClick ? 'cursor-pointer hover:bg-surface-container-high transition-colors duration-200' : ''}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center gap-2 text-on-surface-variant mb-3">
        <span className="w-5 h-5">
          <InsightsIcon />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide">Market Score</span>
      </div>

      {/* Score Content */}
      <div className="flex items-start gap-3">
        {/* Score Ring */}
        <div className="relative flex-shrink-0">
          <svg
            className="w-16 h-16 -rotate-90"
            viewBox="0 0 64 64"
          >
            {/* Background ring */}
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              strokeWidth="6"
              className="stroke-surface-container-highest"
            />
            {/* Progress ring */}
            {hasScore && (
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                className={getRingColor(score)}
                strokeDasharray={`${(score / 100) * 176} 176`}
              />
            )}
          </svg>
          {/* Score number */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : hasScore ? (
              <span className={`text-xl font-bold ${getScoreColor(score)}`}>
                {score}
              </span>
            ) : (
              <span className="text-lg text-on-surface-variant">--</span>
            )}
          </div>
        </div>

        {/* Score Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-medium text-on-surface">{scoreName} Score</span>
            {hasScore && scoreTrend && (
              <TrendArrow
                direction={scoreTrend.direction}
                value={scoreTrend.value}
              />
            )}
          </div>

          {hasScore ? (
            <>
              <p className="text-xs text-on-surface-variant mb-2">
                {getScoreInterpretation(score, viewMode)}
              </p>
              <MarketConditionBadge condition={marketCondition} size="sm" />
            </>
          ) : (
            <p className="text-xs text-on-surface-variant">
              Select a region to see scores
            </p>
          )}
        </div>
      </div>

      {/* Summary Text */}
      {hasScore && summaryText && (
        <p className="mt-3 pt-3 border-t border-outline-variant text-xs text-on-surface-variant leading-relaxed">
          {summaryText}
        </p>
      )}
    </div>
  );
}
