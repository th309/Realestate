'use client';

import React from 'react';
import { BarChart3, Trophy, Check } from 'lucide-react';

import type { ReportInstance } from '../../../../types';
import type { ScoreComponentBreakdown, ComponentStatus } from '@/lib/data';
import { SectionCard, AIAnalysisBlock } from '../core';
import { formatComponentLabel } from '../../utils/scoreHelpers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HeadToHeadScoreStoryProps {
  report: ReportInstance;
  className?: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketComponents {
  id: string;
  name: string;
  components: ScoreComponentBreakdown[];
  colorVar: string;
}

// ---------------------------------------------------------------------------
// Market color palette using report-theme CSS vars
// ---------------------------------------------------------------------------

const MARKET_COLORS = [
  'var(--report-navy)',
  'var(--report-gold)',
  'var(--report-stone)',
] as const;

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/** Map a ComponentStatus to its display bar color */
function getStatusColor(status: ComponentStatus): string {
  switch (status) {
    case 'excellent':
    case 'strong':
      return 'var(--report-success)';
    case 'moderate':
      return 'var(--report-warning)';
    case 'watch':
    case 'concern':
      return 'var(--report-error)';
    default:
      return 'var(--report-stone)';
  }
}

// ---------------------------------------------------------------------------
// ComponentGroup Sub-component
// ---------------------------------------------------------------------------

interface ComponentGroupProps {
  componentName: string;
  marketData: Array<{
    marketName: string;
    score: number;
    status: ComponentStatus;
    colorVar: string;
    isWinner: boolean;
  }>;
  index: number;
}

function ComponentGroup({ componentName, marketData, index }: ComponentGroupProps) {
  return (
    <div
      className={`report-animate-in report-animate-in-delay-${Math.min(index + 1, 5)}`}
      role="listitem"
      aria-label={`${formatComponentLabel(componentName)} comparison`}
    >
      {/* Component label */}
      <div className="mb-[var(--report-space-sm)]">
        <span
          className="text-sm font-semibold"
          style={{
            color: 'var(--report-navy)',
            fontFamily: 'var(--report-font-display)',
          }}
        >
          {formatComponentLabel(componentName)}
        </span>
      </div>

      {/* Bars for each market */}
      <div className="space-y-2">
        {marketData.map((market) => {
          const percentage = Math.min(market.score, 100);

          return (
            <div key={market.marketName} className="flex items-center gap-3">
              {/* Market name + score */}
              <div className="w-[140px] flex-shrink-0 flex items-center justify-between gap-2">
                <span
                  className="text-xs font-medium truncate"
                  style={{
                    color: 'var(--report-stone)',
                    fontFamily: 'var(--report-font-body)',
                  }}
                >
                  {market.marketName}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{
                      color: market.colorVar,
                      fontFamily: 'var(--report-font-display)',
                    }}
                  >
                    {market.score}
                  </span>
                  {market.isWinner && (
                    <Check
                      className="w-3.5 h-3.5"
                      style={{ color: 'var(--report-success)' }}
                      aria-label="Winner for this component"
                    />
                  )}
                </div>
              </div>

              {/* Bar */}
              <div className="flex-1">
                <div
                  className="w-full h-2.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--report-cream-dark)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: market.colorVar,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeadToHeadScoreStory Component
// ---------------------------------------------------------------------------

export function HeadToHeadScoreStory({ report, className = '' }: HeadToHeadScoreStoryProps): React.ReactElement {
  const isInvestor = report.user_type === 'investor';
  const scoreType = isInvestor ? 'investoredge' : 'homeready';
  const componentsKey = isInvestor ? 'investoredge_components' : 'homeready_components';

  // -----------------------------------------------------------------------
  // Primary market components
  // -----------------------------------------------------------------------
  const primaryComponents: ScoreComponentBreakdown[] =
    (report.scores_snapshot as any)?.[componentsKey] ?? [];

  // -----------------------------------------------------------------------
  // Comparison market components (use comparisons record keyed by geo ID)
  // -----------------------------------------------------------------------
  const comparisons = report.populated_data?.comparisons;
  const comparisonGeos = report.comparison_geographies ?? [];

  // Build an ordered list of markets with their components
  const allMarkets: MarketComponents[] = [
    {
      id: report.primary_geography_id,
      name: report.primary_geography_name,
      components: primaryComponents,
      colorVar: MARKET_COLORS[0],
    },
    ...comparisonGeos.map((geo, i) => {
      const comp = comparisons?.[geo.id];
      return {
        id: geo.id,
        name: comp?.geography?.name ?? geo.name,
        components: ((comp?.scores as any)?.[scoreType + '_components'] ?? []) as ScoreComponentBreakdown[],
        colorVar: MARKET_COLORS[Math.min(i + 1, MARKET_COLORS.length - 1)],
      };
    }),
  ];

  // -----------------------------------------------------------------------
  // Build unified component names from all markets
  // -----------------------------------------------------------------------
  const componentNameSet = new Set<string>();
  allMarkets.forEach((market) => {
    market.components.forEach((c) => componentNameSet.add(c.component));
  });
  const componentNames = Array.from(componentNameSet);

  // -----------------------------------------------------------------------
  // AI narrative
  // -----------------------------------------------------------------------
  const scoreComparisonNarrative =
    (report.ai_narrative as any)?.score_comparison ??
    (report.ai_narratives?.score_comparison as string | undefined) ??
    null;

  // -----------------------------------------------------------------------
  // Empty / insufficient data state
  // -----------------------------------------------------------------------
  const hasAnyComponents = allMarkets.some((m) => m.components.length > 0);
  const hasNarrative =
    scoreComparisonNarrative &&
    typeof scoreComparisonNarrative === 'string' &&
    scoreComparisonNarrative.trim() !== '';

  if (!hasAnyComponents && !hasNarrative) {
    return (
      <SectionCard title="Head-to-Head Score Breakdown" icon={BarChart3} className={className}>
        <div className="flex flex-col items-center justify-center py-10">
          <div
            className="w-12 h-12 flex items-center justify-center rounded-full mb-3"
            style={{ backgroundColor: 'var(--report-cream-dark)' }}
          >
            <BarChart3 className="w-5 h-5" style={{ color: 'var(--report-stone-light)' }} />
          </div>
          <p
            className="text-sm text-center max-w-sm"
            style={{ color: 'var(--report-stone-light)', fontFamily: 'var(--report-font-body)' }}
          >
            Score component breakdown is not yet available for this comparison.
            This data will appear once scoring analysis is complete for all markets.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Head-to-Head Score Breakdown" icon={BarChart3} className={className}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* ------------------------------------------------------------- */}
        {/* Market Legend                                                   */}
        {/* ------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-[var(--report-space-md)]">
          {allMarkets.map((market) => (
            <div key={market.id} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: market.colorVar }}
                aria-hidden="true"
              />
              <span
                className="text-xs font-medium"
                style={{
                  color: 'var(--report-stone)',
                  fontFamily: 'var(--report-font-body)',
                }}
              >
                {market.name}
              </span>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Per-Component Grouped Bars                                     */}
        {/* ------------------------------------------------------------- */}
        {hasAnyComponents && componentNames.length > 0 && (
          <div className="space-y-[var(--report-space-lg)]" role="list" aria-label="Score component comparison">
            {componentNames.map((componentName, index) => {
              // Build per-market data for this component
              const marketData = allMarkets.map((market) => {
                const comp = market.components.find((c) => c.component === componentName);
                return {
                  marketName: market.name,
                  score: comp?.score ?? 0,
                  status: (comp?.status ?? 'moderate') as ComponentStatus,
                  colorVar: market.colorVar,
                  isWinner: false, // will be set below
                };
              });

              // Determine winner per component (highest score)
              const maxScore = Math.max(...marketData.map((m) => m.score));
              if (maxScore > 0) {
                const winnerIdx = marketData.findIndex((m) => m.score === maxScore);
                if (winnerIdx >= 0) {
                  marketData[winnerIdx].isWinner = true;
                }
              }

              return (
                <ComponentGroup
                  key={componentName}
                  componentName={componentName}
                  marketData={marketData}
                  index={index}
                />
              );
            })}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Summary: wins tally                                            */}
        {/* ------------------------------------------------------------- */}
        {hasAnyComponents && componentNames.length > 0 && allMarkets.length >= 2 && (
          <div
            className="p-[var(--report-space-md)] rounded-[var(--report-radius-md)]"
            style={{
              backgroundColor: 'var(--report-cream)',
              border: '1px solid rgba(27, 46, 74, 0.04)',
            }}
          >
            <p
              className="text-xs font-medium text-center"
              style={{
                color: 'var(--report-stone)',
                fontFamily: 'var(--report-font-body)',
              }}
            >
              {(() => {
                // Count wins per market
                const winCounts: Record<string, number> = {};
                allMarkets.forEach((m) => { winCounts[m.name] = 0; });

                componentNames.forEach((componentName) => {
                  let maxScore = -1;
                  let winnerId = '';
                  allMarkets.forEach((market) => {
                    const comp = market.components.find((c) => c.component === componentName);
                    const s = comp?.score ?? 0;
                    if (s > maxScore) {
                      maxScore = s;
                      winnerId = market.name;
                    }
                  });
                  if (winnerId && maxScore > 0) {
                    winCounts[winnerId] = (winCounts[winnerId] || 0) + 1;
                  }
                });

                return allMarkets
                  .map((m) => `${m.name}: ${winCounts[m.name] || 0} win${(winCounts[m.name] || 0) !== 1 ? 's' : ''}`)
                  .join('  \u00B7  ');
              })()}
            </p>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* AI Narrative                                                   */}
        {/* ------------------------------------------------------------- */}
        {hasNarrative && (
          <AIAnalysisBlock
            content={scoreComparisonNarrative}
            variant="insight"
            className="report-animate-in report-animate-in-delay-3"
          />
        )}
      </div>
    </SectionCard>
  );
}

export default HeadToHeadScoreStory;
