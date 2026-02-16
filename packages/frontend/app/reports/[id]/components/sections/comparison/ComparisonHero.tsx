'use client';

import React from 'react';
import { Trophy, MapPin } from 'lucide-react';

import type { ReportInstance } from '../../../../types';
import type { ScoreComponentBreakdown } from '@/lib/data';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';
import { AIAnalysisBlock } from '../core';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ComparisonHeroProps {
  report: ReportInstance;
  className?: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketCard {
  id: string;
  name: string;
  score: number | null;
  isWinner: boolean;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/** Convert snake_case component name into a readable label */
function formatComponentLabel(component: string): string {
  return component
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// ComparisonHero Component
// ---------------------------------------------------------------------------

export function ComparisonHero({ report, className = '' }: ComparisonHeroProps): React.ReactElement {
  const isInvestor = report.user_type === 'investor';
  const scoreType = isInvestor ? 'investoredge' : 'homeready';
  const scoreLabel = isInvestor ? 'InvestorEdge Score' : 'HomeReady Score';

  // -----------------------------------------------------------------------
  // Primary market score
  // -----------------------------------------------------------------------
  const primaryScore = isInvestor
    ? (report.investoredge_score ?? report.scores_snapshot?.investoredge_score ?? null)
    : (report.homeready_score ?? report.scores_snapshot?.homeready_score ?? null);

  // -----------------------------------------------------------------------
  // Comparison markets
  // -----------------------------------------------------------------------
  const comparables = (report.populated_data?.comparables ?? []) as Array<{
    geography: { id: string; name: string };
    current?: Record<string, any>;
    scores?: Record<string, any>;
  }>;

  // -----------------------------------------------------------------------
  // Priority-weighted winner
  // -----------------------------------------------------------------------
  const priorityWinner = report.populated_data?.priority_weighted_winner;

  // -----------------------------------------------------------------------
  // Build market list (primary + comparisons)
  // -----------------------------------------------------------------------
  const markets: MarketCard[] = [
    {
      id: report.primary_geography_id,
      name: report.primary_geography_name,
      score: primaryScore,
      isWinner: priorityWinner?.winnerId === report.primary_geography_id,
    },
    ...comparables.map((comp) => ({
      id: comp.geography.id,
      name: comp.geography.name,
      score: (comp.scores?.[scoreType] as number) ?? null,
      isWinner: priorityWinner?.winnerId === comp.geography.id,
    })),
  ];

  // Fallback: if no priority winner set, use highest score
  if (!priorityWinner && markets.length >= 2) {
    const scoredMarkets = markets.filter((m) => m.score !== null);
    if (scoredMarkets.length > 0) {
      const highestScore = Math.max(...scoredMarkets.map((m) => m.score!));
      markets.forEach((m) => {
        m.isWinner = m.score === highestScore;
      });
    }
  }

  // -----------------------------------------------------------------------
  // AI verdict
  // -----------------------------------------------------------------------
  const aiVerdict =
    (report.ai_narrative as any)?.comparison_verdict ??
    (report.ai_narratives?.comparison_verdict as string | undefined) ??
    null;

  // -----------------------------------------------------------------------
  // Grid columns based on market count
  // -----------------------------------------------------------------------
  const gridCols =
    markets.length >= 3
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------
  if (markets.length < 2) {
    return (
      <section
        className={`report-animate-in rounded-[var(--report-radius-xl)] p-[var(--report-space-xl)] md:p-[var(--report-space-2xl)] text-center ${className}`.trim()}
        style={{ backgroundColor: 'white', border: '1px solid rgba(27, 46, 74, 0.04)' }}
      >
        <p
          className="text-[0.9375rem]"
          style={{ color: 'var(--report-stone-light)', fontFamily: 'var(--report-font-body)' }}
        >
          Add a comparison market to see the head-to-head showdown.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`report-animate-in rounded-[var(--report-radius-xl)] overflow-hidden ${className}`.trim()}
      style={{
        background: 'linear-gradient(180deg, var(--report-cream) 0%, white 100%)',
        border: '1px solid rgba(27, 46, 74, 0.06)',
        boxShadow: 'var(--report-shadow-md)',
      }}
      aria-label="Comparison Hero"
    >
      <div className="p-[var(--report-space-xl)] md:p-[var(--report-space-2xl)]">
        {/* ------------------------------------------------------------- */}
        {/* Header: Market A vs Market B                                   */}
        {/* ------------------------------------------------------------- */}
        <header className="text-center mb-[var(--report-space-xl)] report-animate-in">
          <h2
            className="text-2xl md:text-3xl font-bold leading-tight flex flex-wrap items-center justify-center gap-3"
            style={{
              fontFamily: 'var(--report-font-display)',
              color: 'var(--report-navy)',
            }}
          >
            <span>{markets[0].name}</span>
            <span
              className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide"
              style={{
                backgroundColor: 'var(--report-cream-dark)',
                color: 'var(--report-stone)',
                fontFamily: 'var(--report-font-body)',
              }}
            >
              vs
            </span>
            <span>{markets[1].name}</span>
            {markets.length > 2 && (
              <>
                <span
                  className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide"
                  style={{
                    backgroundColor: 'var(--report-cream-dark)',
                    color: 'var(--report-stone)',
                    fontFamily: 'var(--report-font-body)',
                  }}
                >
                  vs
                </span>
                <span>{markets[2].name}</span>
              </>
            )}
          </h2>
        </header>

        {/* ------------------------------------------------------------- */}
        {/* Score Gauges Grid                                              */}
        {/* ------------------------------------------------------------- */}
        <div className={`grid ${gridCols} gap-[var(--report-space-lg)] mb-[var(--report-space-xl)]`}>
          {markets.map((market, idx) => (
            <div
              key={market.id}
              className={`
                relative flex flex-col items-center p-[var(--report-space-lg)] rounded-[var(--report-radius-lg)] transition-all
                report-animate-in report-animate-in-delay-${Math.min(idx + 1, 5)}
              `.trim()}
              style={{
                backgroundColor: market.isWinner ? 'var(--report-success-bg)' : 'white',
                border: market.isWinner
                  ? '2px solid var(--report-success)'
                  : '1px solid rgba(27, 46, 74, 0.06)',
                boxShadow: market.isWinner ? '0 4px 24px rgba(34, 139, 34, 0.1)' : undefined,
              }}
            >
              {/* Winner Badge */}
              {market.isWinner && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
                  style={{
                    backgroundColor: 'var(--report-success)',
                    color: 'white',
                    fontFamily: 'var(--report-font-body)',
                  }}
                >
                  <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                  Winner
                </div>
              )}

              {/* Market Name */}
              <div className="flex items-center gap-1.5 mb-[var(--report-space-md)]">
                <MapPin
                  className="w-3.5 h-3.5"
                  style={{ color: 'var(--report-stone-light)' }}
                  aria-hidden="true"
                />
                <h3
                  className="text-lg font-semibold"
                  style={{
                    fontFamily: 'var(--report-font-display)',
                    color: market.isWinner ? 'var(--report-success)' : 'var(--report-navy)',
                  }}
                >
                  {market.name}
                </h3>
              </div>

              {/* Score Gauge */}
              {market.score !== null ? (
                <ScoreDisplay
                  value={market.score}
                  size={120}
                  strokeWidth={8}
                  showGrade
                  showLabel
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 120,
                    height: 120,
                    backgroundColor: 'var(--report-cream-dark)',
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: 'var(--report-stone-light)',
                      fontFamily: 'var(--report-font-body)',
                    }}
                  >
                    No Score
                  </span>
                </div>
              )}

              {/* Score Type Label */}
              <p
                className="mt-[var(--report-space-sm)] text-sm font-medium"
                style={{
                  color: 'var(--report-stone)',
                  fontFamily: 'var(--report-font-body)',
                }}
              >
                {scoreLabel}
              </p>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Winner Declaration (if priority-weighted)                       */}
        {/* ------------------------------------------------------------- */}
        {priorityWinner && (
          <div
            className="text-center p-[var(--report-space-md)] rounded-[var(--report-radius-md)] mb-[var(--report-space-lg)] report-animate-in report-animate-in-delay-2"
            style={{
              backgroundColor: 'var(--report-success-bg)',
              border: '1px solid rgba(34, 139, 34, 0.15)',
            }}
          >
            <p
              className="text-base font-semibold flex items-center justify-center gap-2"
              style={{
                color: 'var(--report-success)',
                fontFamily: 'var(--report-font-display)',
              }}
            >
              <Trophy className="w-5 h-5" aria-hidden="true" />
              {priorityWinner.winnerName} wins based on your priorities
            </p>
            {priorityWinner.priorityScores && priorityWinner.priorityScores.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-[var(--report-space-sm)]">
                {priorityWinner.priorityScores.slice(0, 3).map((ps) => (
                  <span
                    key={ps.priority}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: 'white',
                      color: 'var(--report-stone)',
                      fontFamily: 'var(--report-font-body)',
                    }}
                  >
                    {formatComponentLabel(ps.priority)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* AI Verdict                                                     */}
        {/* ------------------------------------------------------------- */}
        {aiVerdict && typeof aiVerdict === 'string' && aiVerdict.trim() !== '' && (
          <AIAnalysisBlock
            content={aiVerdict}
            title="Comparison Verdict"
            variant="recommendation"
            className="report-animate-in report-animate-in-delay-3"
          />
        )}
      </div>
    </section>
  );
}

export default ComparisonHero;
