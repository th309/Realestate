'use client';

import React from 'react';
import { Trophy } from 'lucide-react';
import { MyMarket } from '../../hooks/useMyMarkets';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';

interface ScoreShowdownProps {
  primaryMarket: MyMarket;
  comparisonMarket: MyMarket;
  userType: 'homebuyer' | 'investor';
}

/**
 * ScoreShowdown - Side-by-side score gauges with winner badge
 */
export function ScoreShowdown({
  primaryMarket,
  comparisonMarket,
  userType,
}: ScoreShowdownProps) {
  const scoreLabel = userType === 'investor' ? 'InvestorEdge' : 'HomeReady';

  // Determine winner
  const primaryScore = primaryMarket.score ?? 0;
  const comparisonScore = comparisonMarket.score ?? 0;
  const winnerId = primaryScore >= comparisonScore ? primaryMarket.id : comparisonMarket.id;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 items-center mb-8">
      {/* Primary Market Card */}
      <MarketScoreCard
        market={primaryMarket}
        isWinner={winnerId === primaryMarket.id}
        scoreLabel={scoreLabel}
      />

      {/* VS Divider */}
      <div className="flex justify-center">
        <span className="px-5 py-3 bg-surface-container-high rounded-full text-sm font-bold text-on-surface-variant">
          VS
        </span>
      </div>

      {/* Comparison Market Card */}
      <MarketScoreCard
        market={comparisonMarket}
        isWinner={winnerId === comparisonMarket.id}
        scoreLabel={scoreLabel}
      />
    </div>
  );
}

interface MarketScoreCardProps {
  market: MyMarket;
  isWinner: boolean;
  scoreLabel: string;
}

function MarketScoreCard({ market, isWinner, scoreLabel }: MarketScoreCardProps) {
  return (
    <div
      className={`
        relative p-6 rounded-3xl text-center transition-all
        ${isWinner
          ? 'bg-primary-container border-2 border-primary'
          : 'bg-surface-container-low border-2 border-transparent'
        }
      `}
    >
      {/* Winner Badge */}
      {isWinner && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary rounded-full text-on-primary text-xs font-bold uppercase tracking-wide">
            <Trophy className="w-3.5 h-3.5" />
            Winner
          </div>
        </div>
      )}

      {/* Market Name */}
      <h3 className={`text-lg font-medium mb-4 ${isWinner ? 'text-primary' : 'text-on-surface'}`}>
        {market.name}
      </h3>

      {/* Score Gauge */}
      <div className="flex justify-center mb-4">
        {market.score !== null ? (
          <ScoreDisplay
            value={market.score}
            size={140}
            strokeWidth={10}
            showGrade={true}
            showLabel={false}
          />
        ) : (
          <div className="w-[140px] h-[140px] flex items-center justify-center bg-surface-container-high rounded-full">
            <span className="text-on-surface-variant text-sm">No Score</span>
          </div>
        )}
      </div>

      {/* Score Label */}
      <p className="text-sm text-on-surface-variant">
        {scoreLabel} Score
      </p>
    </div>
  );
}

export default ScoreShowdown;
