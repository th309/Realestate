'use client';

import React from 'react';
import { Star, Trophy } from 'lucide-react';
import { SectionCard } from '../core/SectionCard';
import { AIAnalysisBlock } from '../core/AIAnalysisBlock';
import { PersonalizedInsight } from '../core/PersonalizedInsight';
import type { ReportInstance } from '../../../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PriorityWeightedAnalysisProps {
  report: ReportInstance;
  className?: string;
}

interface PriorityScore {
  priority: string;
  weight: number;
  winnerId: string;
  winnerName: string;
  keyMetric: string;
  winnerValue: number | null;
  loserValue: number | null;
  reason: string;
}

interface PriorityWeightedWinner {
  winnerId: string;
  winnerName: string;
  totalScore: number;
  priorityScores: PriorityScore[];
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert snake_case priority name into a readable label. */
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
    growth_potential: 'Growth Potential',
    rent_demand: 'Rent Demand',
    risk: 'Risk',
    entry_point: 'Entry Point',
  };
  return (
    labels[priority] ||
    priority
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

/** Format a metric value loosely based on the metric key name. */
function formatValue(value: number | null, metricKey: string): string {
  if (value === null || value === undefined) return '\u2014';

  const currencyHints = ['price', 'income', 'rent', 'value', 'sqft'];
  const percentHints = [
    'rate',
    'yield',
    'growth',
    'yoy',
    'appreciation',
    'pct',
    'share',
    'vacancy',
    'unemployment',
  ];

  const keyLower = metricKey.toLowerCase();

  if (currencyHints.some((h) => keyLower.includes(h))) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
    return `$${value.toFixed(0)}`;
  }

  if (percentHints.some((h) => keyLower.includes(h))) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }

  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PriorityWeightedAnalysis({
  report,
  className,
}: PriorityWeightedAnalysisProps) {
  const priorityWinner = (report.populated_data as any)
    ?.priority_weighted_winner as PriorityWeightedWinner | undefined;

  // Conditional render: return null if no data
  if (!priorityWinner) {
    return null;
  }

  const { priorityScores, winnerName, totalScore } = priorityWinner;

  // AI narratives
  const aiNarratives: Record<string, any> =
    (report.ai_narratives as Record<string, any>) ||
    (report.ai_narrative as Record<string, any>) ||
    {};
  const priorityAnalysis = aiNarratives.priority_analysis as string | undefined;

  // User priorities for personalized insight
  const userPriorities = (report.user_inputs?.priorities as string[]) || [];

  // Max weight for bar scaling
  const maxWeight =
    priorityScores.length > 0
      ? Math.max(...priorityScores.map((ps) => ps.weight))
      : 1;

  return (
    <SectionCard title="Your Priorities Analysis" icon={Star} className={className}>
      <div className="space-y-[var(--report-space-md)]">
        {/* Priority Cards */}
        {priorityScores.map((ps, index) => {
          const label = formatPriorityLabel(ps.priority);
          const barWidthPct = maxWeight > 0 ? (ps.weight / maxWeight) * 100 : 0;

          return (
            <div
              key={ps.priority}
              className="rounded-[var(--report-radius-md)] overflow-hidden"
              style={{
                border: '1px solid rgba(27, 46, 74, 0.08)',
                backgroundColor: 'white',
              }}
            >
              <div className="p-[var(--report-space-md)]">
                {/* Priority Label & Weight */}
                <div className="flex items-center justify-between gap-3 mb-[var(--report-space-sm)]">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        backgroundColor: 'var(--report-navy)',
                        color: 'white',
                      }}
                    >
                      {index + 1}
                    </span>
                    <h4
                      className="text-sm font-semibold"
                      style={{
                        fontFamily: 'var(--report-font-display)',
                        color: 'var(--report-navy)',
                      }}
                    >
                      {label}
                    </h4>
                  </div>
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    Weight: {(ps.weight * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Weight Bar */}
                <div
                  className="h-2 rounded-full overflow-hidden mb-[var(--report-space-sm)]"
                  style={{ backgroundColor: 'var(--report-cream-dark)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidthPct}%`,
                      backgroundColor: 'var(--report-navy)',
                      opacity: 0.7,
                    }}
                  />
                </div>

                {/* Winner for this priority */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Trophy
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{ color: 'var(--report-success)' }}
                    />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'var(--report-success)' }}
                    >
                      {ps.winnerName}
                    </span>
                    {ps.winnerValue !== null && (
                      <span
                        className="text-xs"
                        style={{ color: 'var(--report-stone)' }}
                      >
                        ({formatValue(ps.winnerValue, ps.keyMetric)}
                        {ps.loserValue !== null && (
                          <> vs {formatValue(ps.loserValue, ps.keyMetric)}</>
                        )}
                        )
                      </span>
                    )}
                  </div>
                </div>

                {/* Reason */}
                {ps.reason && (
                  <p
                    className="text-[0.8125rem] mt-[var(--report-space-xs)] leading-relaxed"
                    style={{ color: 'var(--report-stone)' }}
                  >
                    {ps.reason}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Overall Verdict */}
        <div
          className="rounded-[var(--report-radius-md)] p-[var(--report-space-lg)] text-center"
          style={{
            backgroundColor: 'var(--report-success-bg)',
            border: '1px solid var(--report-success)',
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-[var(--report-space-xs)]">
            <Trophy className="w-5 h-5" style={{ color: 'var(--report-success)' }} />
            <h3
              className="text-lg font-bold"
              style={{
                fontFamily: 'var(--report-font-display)',
                color: 'var(--report-navy)',
              }}
            >
              {winnerName}
            </h3>
          </div>
          <p
            className="text-sm"
            style={{ color: 'var(--report-stone)' }}
          >
            Based on your priorities, <strong>{winnerName}</strong> is the stronger
            choice with a weighted score of{' '}
            <strong>{totalScore.toFixed(1)}</strong>.
          </p>
        </div>
      </div>

      {/* AI Analysis */}
      {priorityAnalysis && (
        <div className="mt-[var(--report-space-lg)]">
          <AIAnalysisBlock content={priorityAnalysis} variant="insight" />
        </div>
      )}

      {/* Personalized Insight */}
      {userPriorities.length > 0 && (
        <div className="mt-[var(--report-space-md)]">
          <PersonalizedInsight
            content={
              `Your priorities (${userPriorities.map(formatPriorityLabel).join(', ')}) ` +
              `were used to weight the comparison. ${
                winnerName
                  ? `${winnerName} aligned most closely with what matters to you.`
                  : 'The results reflect which market best matches what matters to you.'
              }`
            }
            inputsUsed={['priorities']}
          />
        </div>
      )}
    </SectionCard>
  );
}

export default PriorityWeightedAnalysis;
