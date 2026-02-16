'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

import type { ReportInstance } from '../../../../types';
import type { ScoreComponentBreakdown } from '@/lib/data';
import { SectionCard } from '../core/SectionCard';
import { ComponentScoreBadge } from '../core/ComponentScoreBadge';
import { AIAnalysisBlock } from '../core/AIAnalysisBlock';
import { formatComponentLabel } from '../../utils/scoreHelpers';

interface MarketStrengthsProps {
  report: ReportInstance;
  className?: string;
}

interface MarketEntry {
  id: string;
  name: string;
  components: ScoreComponentBreakdown[];
  score: number | null;
}

/**
 * Returns a brief interpretation based on the component score.
 */
function getInterpretation(score: number): string {
  if (score >= 75) return 'Outstanding';
  if (score >= 55) return 'Solid';
  return 'Room to grow';
}

/**
 * MarketStrengths - Shows each market's top strengths
 *
 * Displays what each market does best by sorting score components
 * descending and highlighting the top 3 as strengths.
 */
export function MarketStrengths({
  report,
  className = '',
}: MarketStrengthsProps): React.ReactElement {
  const isInvestor = report.user_type === 'investor';
  const scoreType = isInvestor ? 'investoredge' : 'homeready';
  const componentsKey = isInvestor
    ? 'investoredge_components'
    : 'homeready_components';

  // Build market list: primary + comparisons
  const comparisons = report.comparison_geographies || [];
  const markets: MarketEntry[] = [
    {
      id: report.primary_geography_id,
      name: report.primary_geography_name,
      components:
        (report.scores_snapshot as any)?.[componentsKey] || [],
      score: isInvestor
        ? report.investoredge_score
        : report.homeready_score,
    },
    ...comparisons.map((geo) => {
      const comp = report.populated_data?.comparisons?.[geo.id];
      return {
        id: geo.id,
        name: geo.name,
        components: (comp?.scores as any)?.[componentsKey] || [],
        score: (comp?.scores as any)?.[scoreType] ?? null,
      };
    }),
  ];

  // Determine grid columns based on market count
  const gridCols =
    markets.length >= 3
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  // Get AI narrative
  const aiNarratives = report.ai_narratives || report.ai_narrative || {};
  const marketStrengthsNarrative =
    (aiNarratives as any)?.market_strengths as string | undefined;

  // Collect per-market narratives if available
  const perMarketNarratives: string[] = markets
    .map((m) => (aiNarratives as any)?.[`market_strengths_${m.id}`] as string)
    .filter(Boolean);

  const narrativeContent =
    marketStrengthsNarrative ||
    (perMarketNarratives.length > 0 ? perMarketNarratives : null);

  return (
    <SectionCard
      title="Where Each Market Shines"
      icon={Sparkles}
      className={className}
    >
      <div className={`grid ${gridCols} gap-[var(--report-space-md)]`}>
        {markets.map((market) => {
          // Sort components by score descending and take top 3
          const sorted = [...market.components].sort(
            (a, b) => b.score - a.score
          );
          const topStrengths = sorted.slice(0, 3);

          return (
            <div
              key={market.id}
              className="p-[var(--report-space-lg)] rounded-[var(--report-radius-md)]"
              style={{
                backgroundColor: 'white',
                border: '1px solid rgba(27, 46, 74, 0.08)',
              }}
            >
              {/* Market name */}
              <h3
                className="text-base font-semibold mb-[var(--report-space-md)]"
                style={{
                  fontFamily: 'var(--report-font-display)',
                  color: 'var(--report-navy)',
                }}
              >
                {market.name}
              </h3>

              {/* Strengths list */}
              {topStrengths.length > 0 ? (
                <div className="space-y-[var(--report-space-sm)]">
                  {topStrengths.map((comp) => (
                    <div key={comp.component}>
                      <ComponentScoreBadge
                        component={comp.component}
                        score={comp.score}
                        label={formatComponentLabel(comp.component)}
                        status={comp.status}
                        compact
                      />
                      <p
                        className="text-xs mt-1 ml-[52px]"
                        style={{
                          color: 'var(--report-stone)',
                          fontFamily: 'var(--report-font-body)',
                        }}
                      >
                        {getInterpretation(comp.score)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  className="text-sm py-[var(--report-space-md)]"
                  style={{ color: 'var(--report-stone-light)' }}
                >
                  Score breakdown unavailable
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Narrative */}
      {narrativeContent && (
        <div className="mt-[var(--report-space-lg)]">
          <AIAnalysisBlock
            content={narrativeContent}
            title="Strengths Analysis"
            variant="insight"
          />
        </div>
      )}
    </SectionCard>
  );
}

export default MarketStrengths;
