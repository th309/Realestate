'use client';

import React from 'react';
import { Trophy } from 'lucide-react';
import { SectionProps } from '../../types';
import { SectionCard } from '../core/SectionCard';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';

interface MarketScore {
  id: string;
  name: string;
  score: number | null;
  isWinner: boolean;
}

/**
 * ComparisonHeroShowdown - Side-by-side score comparison with winner declaration
 *
 * Part 1A of the redesigned comparison report.
 * Shows both markets' PropertyIQ scores with visual gauges and winner badge.
 */
export function ComparisonHeroShowdown({ section, report }: SectionProps) {
  const isInvestor = report.user_type === 'investor';
  const scoreType = isInvestor ? 'investoredge' : 'homeready';
  const scoreLabel = isInvestor ? 'InvestorEdge' : 'HomeReady';

  // Get primary market score
  const primaryScore = isInvestor
    ? report.investoredge_score
    : report.homeready_score;

  // Get comparison markets with scores
  const comparables = report.populated_data?.comparables || [];
  const priorities = report.user_inputs?.priorities as string[] || [];

  // Get priority-weighted winner from report data (set by backend)
  const priorityWinner = report.populated_data?.priority_weighted_winner as {
    winnerId: string;
    winnerName: string;
    totalScore: number;
    priorityScores: Array<{
      priority: string;
      winnerId: string;
      winnerName: string;
      weight: number;
      keyMetric: string;
      winnerValue: number | null;
      loserValue: number | null;
      reason: string;
    }>;
  } | undefined;

  // Build market list
  const markets: MarketScore[] = [
    {
      id: report.primary_geography_id,
      name: report.primary_geography_name,
      score: primaryScore,
      isWinner: priorityWinner?.winnerId === report.primary_geography_id,
    },
    ...comparables.map(comp => ({
      id: comp.geography.id,
      name: comp.geography.name,
      score: comp.scores?.[scoreType] as number | null ?? null,
      isWinner: priorityWinner?.winnerId === comp.geography.id,
    })),
  ];

  // Fallback: if no priority winner, use highest score
  if (!priorityWinner && markets.length >= 2) {
    const highestScore = Math.max(...markets.filter(m => m.score !== null).map(m => m.score!));
    markets.forEach(m => {
      m.isWinner = m.score === highestScore;
    });
  }

  const winner = markets.find(m => m.isWinner);

  if (markets.length < 2) {
    return (
      <SectionCard title="Market Comparison" icon={Trophy}>
        <p className="text-on-surface-variant text-center py-8">
          Add a comparison market to see the showdown.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="report-section report-animate-in">
      {/* Header with VS */}
      <header className="text-center mb-8">
        <h2 className="report-heading-lg flex items-center justify-center gap-4">
          <span className="text-on-surface">{markets[0].name}</span>
          <span className="px-4 py-2 bg-surface-container-high rounded-full text-sm font-bold text-on-surface-variant">
            VS
          </span>
          <span className="text-on-surface">{markets[1].name}</span>
        </h2>
      </header>

      {/* Score Gauges Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {markets.slice(0, 2).map((market) => (
          <div
            key={market.id}
            className={`
              relative p-6 rounded-2xl transition-all
              ${market.isWinner
                ? 'bg-primary/10 border-2 border-primary shadow-lg shadow-primary/10'
                : 'bg-surface-container border border-outline-variant'
              }
            `}
          >
            {/* Winner Badge */}
            {market.isWinner && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-primary rounded-full text-on-primary text-xs font-bold">
                  <Trophy className="w-3.5 h-3.5" />
                  WINNER
                </div>
              </div>
            )}

            <div className="flex flex-col items-center">
              {/* Market Name */}
              <h3 className={`text-lg font-semibold mb-4 ${market.isWinner ? 'text-primary' : 'text-on-surface'}`}>
                {market.name}
              </h3>

              {/* Score Gauge */}
              {market.score !== null ? (
                <ScoreDisplay
                  value={market.score}
                  size={140}
                  strokeWidth={10}
                  showGrade={true}
                  showLabel={true}
                />
              ) : (
                <div className="w-[140px] h-[140px] flex items-center justify-center bg-surface-container-high rounded-full">
                  <span className="text-on-surface-variant text-sm">No Score</span>
                </div>
              )}

              {/* Score Type Label */}
              <p className="mt-4 text-sm text-on-surface-variant">
                {scoreLabel} Score
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Winner Declaration */}
      {winner && priorities.length > 0 && (
        <div className="text-center p-6 bg-primary/5 rounded-xl border border-primary/20">
          <p className="text-lg font-semibold text-primary mb-2">
            <Trophy className="w-5 h-5 inline-block mr-2 -mt-1" />
            {winner.name} wins for your priorities
          </p>
          <p className="text-sm text-on-surface-variant">
            Based on: {priorities.slice(0, 3).map((p, i) => (
              <span key={p}>
                {i + 1}) {formatPriorityLabel(p)}
                {i < Math.min(priorities.length, 3) - 1 ? '  ' : ''}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}

/** Format priority ID to display label */
function formatPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    affordability: 'Affordability',
    appreciation: 'Appreciation',
    job_market: 'Job Market',
    market_timing: 'Market Timing',
    lifestyle: 'Lifestyle',
    cash_flow: 'Cash Flow',
    tenant_demand: 'Tenant Demand',
    entry_price: 'Entry Price',
    stability: 'Stability',
  };
  return labels[priority] || priority;
}

export default ComparisonHeroShowdown;
