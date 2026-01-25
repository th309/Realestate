/**
 * SidebarScoreCard Component
 *
 * Displays a carousel of PropertyIQ scores at the top of the sidebar.
 * Shows three scores:
 * - Market Health Score (default, free)
 * - HomeReady Score (pro feature)
 * - InvestorEdge Score (pro feature)
 *
 * Uses the standardized ScoreDisplay component for consistent visualization.
 */

import { useState } from 'react';
import { InsightsIcon, ChevronLeftIcon, ChevronRightIcon, LockIcon } from '../Icons';
import { TrendArrow, getTrendDirection, formatTrendValue } from './TrendArrow';
import { MarketCondition } from './MarketConditionBadge';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';
import { Loader2 } from 'lucide-react';

export type ScoreTypeKey = 'marketHealth' | 'homeready' | 'investoredge';

interface ScoreInfo {
  score?: number;
  trend?: number; // Change from 3 months ago (e.g., +2.5 or -1.3)
  access: 'full' | 'teaser';
}

interface SidebarScoreCardProps {
  marketHealthScore?: ScoreInfo;
  homereadyScore?: ScoreInfo;
  investoredgeScore?: ScoreInfo;
  isLoading?: boolean;
  onClick?: () => void;
  onUpgradeClick?: () => void;
}

const SCORE_CONFIG: Record<ScoreTypeKey, { name: string; label: string; isPro: boolean }> = {
  marketHealth: {
    name: 'Market Health',
    label: 'Market Health Score',
    isPro: false,
  },
  homeready: {
    name: 'HomeReady',
    label: 'HomeReady Score',
    isPro: true,
  },
  investoredge: {
    name: 'InvestorEdge',
    label: 'InvestorEdge Score',
    isPro: true,
  },
};

const SCORE_ORDER: ScoreTypeKey[] = ['marketHealth', 'homeready', 'investoredge'];

export function SidebarScoreCard({
  marketHealthScore,
  homereadyScore,
  investoredgeScore,
  isLoading = false,
  onClick,
  onUpgradeClick,
}: SidebarScoreCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeScoreKey = SCORE_ORDER[activeIndex];
  const config = SCORE_CONFIG[activeScoreKey];

  // Get current score data
  const getScoreData = (key: ScoreTypeKey): ScoreInfo | undefined => {
    switch (key) {
      case 'marketHealth':
        return marketHealthScore;
      case 'homeready':
        return homereadyScore;
      case 'investoredge':
        return investoredgeScore;
    }
  };

  const currentScore = getScoreData(activeScoreKey);
  const hasScore = currentScore?.score !== undefined && !isLoading;
  const isLocked = config.isPro && currentScore?.access === 'teaser';

  // Navigation handlers
  const goToPrevious = () => {
    setActiveIndex((prev) => (prev === 0 ? SCORE_ORDER.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev === SCORE_ORDER.length - 1 ? 0 : prev + 1));
  };

  // Calculate trend display (same approach as Market Factors: always show arrow when we have a score)
  const trendDirection = currentScore?.trend !== undefined
    ? getTrendDirection(currentScore.trend)
    : 'flat';
  const trendValue = currentScore?.trend !== undefined
    ? formatTrendValue(currentScore.trend, 'points')
    : '0.0 pts';

  return (
    <div
      className={`
        bg-surface-container rounded-xl p-3 mb-4 border border-outline-variant
        ${onClick && !isLocked ? 'cursor-pointer hover:bg-surface-container-high transition-colors duration-200' : ''}
      `}
      onClick={!isLocked ? onClick : undefined}
    >
      {/* Header with score name */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-on-surface">
          <span className="w-5 h-5 text-on-surface-variant">
            <InsightsIcon />
          </span>
          <span className="text-sm font-semibold">{config.label}</span>
          {config.isPro && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-primary text-on-primary rounded">
              Pro
            </span>
          )}
        </div>
      </div>

      {/* Score Content */}
      <div className="flex items-start gap-3">
        {/* Score Display */}
        <div className="flex-shrink-0 relative">
          {isLoading ? (
            <div className="w-16 h-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
            </div>
          ) : hasScore && !isLocked ? (
            <ScoreDisplay
              value={currentScore.score!}
              size={64}
              strokeWidth={5}
              showLabel={false}
            />
          ) : isLocked ? (
            <div className="w-16 h-16 flex items-center justify-center rounded-full border-4 border-surface-container-highest bg-surface-container-high">
              <LockIcon className="w-6 h-6 text-on-surface-variant" />
            </div>
          ) : (
            <div className="w-16 h-16 flex items-center justify-center rounded-full border-4 border-surface-container-highest">
              <span className="text-lg text-on-surface-variant">--</span>
            </div>
          )}
        </div>

        {/* Score Details */}
        <div className="flex-1 min-w-0">
          {isLocked ? (
            <div>
              <p className="text-xs text-on-surface-variant mb-2">
                Upgrade to Pro to unlock {config.name} insights
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpgradeClick?.();
                }}
                className="px-3 py-1.5 text-xs font-medium bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors"
              >
                Upgrade to Pro
              </button>
            </div>
          ) : hasScore ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-on-surface-variant">3-month change</span>
                <TrendArrow
                  direction={trendDirection}
                  value={trendValue}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-on-surface-variant">
              Select a region to see scores
            </p>
          )}
        </div>
      </div>

      {/* Carousel Navigation */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant">
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          className="p-1 rounded-full hover:bg-surface-container-high transition-colors"
          aria-label="Previous score"
        >
          <ChevronLeftIcon className="w-4 h-4 text-on-surface-variant" />
        </button>

        {/* Carousel Dots */}
        <div className="flex items-center gap-2">
          {SCORE_ORDER.map((key, index) => {
            const scoreConfig = SCORE_CONFIG[key];
            const scoreData = getScoreData(key);
            const isActive = index === activeIndex;
            const isPro = scoreConfig.isPro && scoreData?.access === 'teaser';

            return (
              <button
                key={key}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(index);
                }}
                className={`
                  relative w-2 h-2 rounded-full transition-all
                  ${isActive
                    ? 'w-6 bg-primary'
                    : isPro
                      ? 'bg-surface-container-highest'
                      : 'bg-outline-variant hover:bg-outline'
                  }
                `}
                aria-label={`View ${scoreConfig.name} score`}
              >
                {isPro && !isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="p-1 rounded-full hover:bg-surface-container-high transition-colors"
          aria-label="Next score"
        >
          <ChevronRightIcon className="w-4 h-4 text-on-surface-variant" />
        </button>
      </div>
    </div>
  );
}
