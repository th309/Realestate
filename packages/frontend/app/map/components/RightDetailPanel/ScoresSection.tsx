/**
 * ScoresSection Component
 *
 * Displays PropertyIQ scores (Market Health, HomeReady, InvestorEdge) in the detail panel.
 * Shows badges in collapsed state, expandable to full ScoreCard view.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, memo } from 'react';
import { ScoreBadge } from '@/app/components/scoring/ScoreBadge';
import { ScoreCard } from '@/app/components/scoring/ScoreCard';
import type { ScoreType, TrendDirection, ScoreAccess, ScoreStatus } from '@/app/components/scoring/ScoreBadge';
import { useScoreData } from '../../hooks/useScoreData';
import type { GeographyType, AllScoresResponse, ScoreBadgeData, ScoreCardData, ScoreTeaserData } from '../../hooks/useScoreData';

interface ScoresSectionProps {
  geographyType: GeographyType | null;
  geographyId: string | null;
  userTier?: string;
  className?: string;
}

// Type guard for ScoreCardData
function isScoreCardData(score: ScoreBadgeData | ScoreCardData | ScoreTeaserData): score is ScoreCardData {
  return 'components' in score && 'confidence' in score;
}

// Type guard for ScoreTeaserData
function isTeaserData(score: ScoreBadgeData | ScoreCardData | ScoreTeaserData): score is ScoreTeaserData {
  return 'upgradeCta' in score && 'lockedComponents' in score;
}

/**
 * Loading skeleton for scores section
 */
function ScoresSkeleton() {
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="w-16 h-20 bg-surface-container-highest rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/**
 * Error state display
 */
function ScoresError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-4">
      <p className="text-sm text-on-surface-variant mb-2">{message}</p>
      <button
        onClick={onRetry}
        className="text-sm text-primary hover:text-primary/80 font-medium"
      >
        Try again
      </button>
    </div>
  );
}

export const ScoresSection = memo(function ScoresSection({
  geographyType,
  geographyId,
  userTier = 'free',
  className = '',
}: ScoresSectionProps) {
  const [expandedScore, setExpandedScore] = useState<ScoreType | null>(null);

  const { data, loading, error, refetch } = useScoreData(geographyType, geographyId, {
    expanded: true,
    historyMonths: expandedScore ? 6 : 0,
    userTier,
  });

  const handleBadgeClick = (type: ScoreType) => {
    setExpandedScore(expandedScore === type ? null : type);
  };

  const handleCardClose = () => {
    setExpandedScore(null);
  };

  const handleUpgradeClick = () => {
    window.location.href = '/pricing?utm_source=score_panel&utm_medium=upgrade_cta';
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className={`space-y-3 ${className}`}>
        <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">
          PropertyIQ Scores
        </h3>
        <ScoresSkeleton />
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className={`space-y-3 ${className}`}>
        <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">
          PropertyIQ Scores
        </h3>
        <ScoresError message={error} onRetry={refetch} />
      </div>
    );
  }

  // No data state
  if (!data) {
    return null;
  }

  // Helper to get score badge props from response data
  const getScoreData = (type: ScoreType): ScoreBadgeData | ScoreCardData | ScoreTeaserData | null => {
    switch (type) {
      case 'market_health':
        return data.marketHealth;
      case 'homeready':
        return data.homeready;
      case 'investoredge':
        return data.investoredge;
      default:
        return null;
    }
  };

  // Render expanded ScoreCard
  if (expandedScore) {
    const scoreData = getScoreData(expandedScore);
    if (!scoreData) return null;

    // Build card props based on score data type
    const cardProps = {
      type: expandedScore,
      label: scoreData.label,
      score: scoreData.score,
      trend: scoreData.trend,
      trendChange: scoreData.trendChange,
      access: scoreData.access,
      status: scoreData.status,
      statusMessage: scoreData.statusMessage,
      onClose: handleCardClose,
      onUpgradeClick: handleUpgradeClick,
    };

    if (isScoreCardData(scoreData)) {
      return (
        <div className={className}>
          <ScoreCard
            {...cardProps}
            components={scoreData.components.map((c) => ({
              ...c,
              metrics: c.metrics.map((m) => ({
                ...m,
                label: m.name,
              })),
            }))}
            confidence={scoreData.confidence}
            history={scoreData.history?.data}
            dataCompleteness={scoreData.dataCompleteness}
          />
        </div>
      );
    }

    if (isTeaserData(scoreData)) {
      return (
        <div className={className}>
          <ScoreCard
            {...cardProps}
            upgradeCta={scoreData.upgradeCta}
          />
        </div>
      );
    }

    // Badge-only data - show minimal card
    return (
      <div className={className}>
        <ScoreCard {...cardProps} />
      </div>
    );
  }

  // Render badges row
  const scores: ScoreType[] = ['market_health', 'homeready', 'investoredge'];

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">
        PropertyIQ Scores
      </h3>

      <div className="flex gap-2 justify-center">
        {scores.map((type) => {
          const scoreData = getScoreData(type);
          if (!scoreData) return null;

          return (
            <ScoreBadge
              key={type}
              type={type}
              label={scoreData.label}
              score={scoreData.score}
              trend={scoreData.trend}
              trendChange={scoreData.trendChange}
              access={scoreData.access}
              status={scoreData.status}
              statusMessage={scoreData.statusMessage}
              size="sm"
              onClick={() => handleBadgeClick(type)}
            />
          );
        })}
      </div>

      {/* Data freshness indicator */}
      <p className="text-xs text-on-surface-variant text-center">
        As of {new Date(data.periodDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
      </p>
    </div>
  );
});

export default ScoresSection;
