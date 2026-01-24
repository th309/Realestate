/**
 * SidebarScoreCard Component
 *
 * Displays at the top of the sidebar showing the overall market score.
 * Shows different scores based on view mode:
 * - Homebuyer: HomeReady Score
 * - Investor: InvestorEdge Score
 *
 * Uses the standardized ScoreDisplay component for consistent visualization.
 */

import type { ViewMode } from '../../types';
import { InsightsIcon } from '../Icons';
import { TrendArrow, TrendDirection } from './TrendArrow';
import { MarketConditionBadge, MarketCondition } from './MarketConditionBadge';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';
import { Loader2 } from 'lucide-react';

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
        {/* Score Display */}
        <div className="flex-shrink-0">
          {isLoading ? (
            <div className="w-16 h-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
            </div>
          ) : hasScore ? (
            <ScoreDisplay
              value={score}
              size={64}
              strokeWidth={5}
              showLabel={false}
            />
          ) : (
            <div className="w-16 h-16 flex items-center justify-center rounded-full border-4 border-surface-container-highest">
              <span className="text-lg text-on-surface-variant">--</span>
            </div>
          )}
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
            <MarketConditionBadge condition={marketCondition} size="sm" />
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
