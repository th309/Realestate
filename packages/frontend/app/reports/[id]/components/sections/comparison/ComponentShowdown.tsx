'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import { SectionCard } from '../core/SectionCard';
import { ComponentScoreBadge } from '../core/ComponentScoreBadge';
import { AIAnalysisBlock } from '../core/AIAnalysisBlock';
import { formatMetricValue } from '@/lib/data';
import type { MetricFormat, ComponentStatus, ScoreComponentBreakdown } from '@/lib/data';
import type { ReportInstance } from '../../../../types';
import { getMetricValueWithAliases } from '../../utils/metricHelpers';
import { formatComponentLabel } from '../../utils/scoreHelpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComponentShowdownProps {
  report: ReportInstance;
  className?: string;
}

interface MarketEntry {
  id: string;
  name: string;
  componentScore: number;
  componentStatus: ComponentStatus;
}

// ---------------------------------------------------------------------------
// Component-to-metrics mapping
// ---------------------------------------------------------------------------

const COMPONENT_METRICS: Record<string, Array<{ metricId: string; label: string; format: MetricFormat }>> = {
  affordability: [
    { metricId: 'zhvi', label: 'Median Home Price', format: 'currency' },
    { metricId: 'median_income', label: 'Median Income', format: 'currency' },
    { metricId: 'price_to_income', label: 'Price-to-Income', format: 'number' },
  ],
  market_timing: [
    { metricId: 'days_on_market', label: 'Days on Market', format: 'days' },
    { metricId: 'for_sale_inventory', label: 'Active Listings', format: 'number' },
    { metricId: 'hotness_score', label: 'Hotness Score', format: 'number' },
  ],
  stability: [
    { metricId: 'home_value_yoy', label: 'Home Value YoY', format: 'percent' },
    { metricId: 'days_on_market', label: 'Days on Market', format: 'days' },
    { metricId: 'price_reduced_share', label: 'Price Cuts', format: 'percent' },
  ],
  growth_potential: [
    { metricId: 'home_value_yoy', label: 'Home Value YoY', format: 'percent' },
    { metricId: 'population_growth', label: 'Population Growth', format: 'percent' },
    { metricId: 'hotness_score', label: 'Hotness Score', format: 'number' },
  ],
  // Investor components
  cash_flow: [
    { metricId: 'cap_rate', label: 'Cap Rate', format: 'percent' },
    { metricId: 'gross_yield', label: 'Gross Yield', format: 'percent' },
    { metricId: 'zori', label: 'Rent Index', format: 'currency' },
  ],
  rent_demand: [
    { metricId: 'rent_yoy', label: 'Rent YoY', format: 'percent' },
    { metricId: 'vacancy_rate', label: 'Vacancy Rate', format: 'percent' },
    { metricId: 'pending_ratio', label: 'Pending Ratio', format: 'percent' },
  ],
  appreciation: [
    { metricId: 'home_value_yoy', label: 'Home Value YoY', format: 'percent' },
    { metricId: 'appreciation_3yr', label: '3-Yr Growth', format: 'percent' },
  ],
  entry_point: [
    { metricId: 'zhvi', label: 'Median Price', format: 'currency' },
    { metricId: 'price_per_sqft', label: 'Price/Sqft', format: 'currency' },
    { metricId: 'price_reduced_share', label: 'Price Cuts', format: 'percent' },
  ],
  risk: [
    { metricId: 'overvaluation_pct', label: 'Overvaluation', format: 'percent' },
    { metricId: 'vacancy_rate', label: 'Vacancy Rate', format: 'percent' },
    { metricId: 'unemployment_rate', label: 'Unemployment', format: 'percent' },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a metric value from a comparison market's current data with alias fallback. */
function getCompMetricValue(comp: any, metricId: string): number | null {
  const aliases: Record<string, string[]> = {
    zhvi: ['home_value', 'median_listing_price', 'median_home_value'],
    home_value: ['zhvi', 'median_listing_price'],
    zori: ['median_gross_rent', 'rent_index'],
  };
  const val = comp?.current?.[metricId];
  if (val !== undefined && val !== null) return Number(val);
  for (const alias of aliases[metricId] || []) {
    const aliasVal = comp?.current?.[alias];
    if (aliasVal !== undefined && aliasVal !== null) return Number(aliasVal);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComponentShowdown({ report, className }: ComponentShowdownProps) {
  const isInvestor = report.user_type === 'investor';
  const scoreType = isInvestor ? 'investoredge' : 'homeready';
  const componentsKey = scoreType + '_components';

  // Primary market's components array
  const primaryComponents: ScoreComponentBreakdown[] =
    (report.scores_snapshot as any)?.[componentsKey] || [];

  // Comparison market data (use comparisons record keyed by geo ID)
  const comparisons = report.populated_data?.comparisons;
  const comparisonGeos = report.comparison_geographies ?? [];

  if (primaryComponents.length === 0) {
    return (
      <SectionCard title="Component-by-Component" icon={Layers} className={className}>
        <p
          className="text-center py-8 text-sm"
          style={{ color: 'var(--report-stone-light)' }}
        >
          Score component breakdown is not available for this report.
        </p>
      </SectionCard>
    );
  }

  // AI narratives (may be in either key)
  const aiNarratives: Record<string, any> =
    (report.ai_narratives as Record<string, any>) ||
    (report.ai_narrative as Record<string, any>) ||
    {};

  return (
    <SectionCard title="Component-by-Component" icon={Layers} className={className}>
      <div className="space-y-[var(--report-space-lg)]">
        {primaryComponents.map((comp) => {
          const componentName = comp.component;
          const label = formatComponentLabel(componentName);
          const metrics = COMPONENT_METRICS[componentName] || [];

          // Build market entries: primary + comparisons
          const markets: MarketEntry[] = [
            {
              id: report.primary_geography_id,
              name: report.primary_geography_name,
              componentScore: comp.score,
              componentStatus: comp.status,
            },
          ];

          // Add comparison markets
          for (const geo of comparisonGeos) {
            const compData = comparisons?.[geo.id];
            const compScores = (compData?.scores as any)?.[componentsKey] as
              | ScoreComponentBreakdown[]
              | undefined;
            const matchingComp = compScores?.find(
              (c: ScoreComponentBreakdown) => c.component === componentName
            );

            markets.push({
              id: geo.id,
              name: compData?.geography?.name ?? geo.name,
              componentScore: matchingComp?.score ?? 0,
              componentStatus: matchingComp?.status ?? 'moderate',
            });
          }

          // Determine the winner (highest component score)
          const winnerId = markets.reduce(
            (best, m) => (m.componentScore > best.componentScore ? m : best),
            markets[0]
          ).id;

          // Narrative for this component (optional)
          const narrative =
            aiNarratives['component_comparison_' + componentName] as string | undefined;

          return (
            <div
              key={componentName}
              className="rounded-[var(--report-radius-lg)] overflow-hidden"
              style={{
                border: '1px solid rgba(27, 46, 74, 0.08)',
                backgroundColor: 'var(--report-cream)',
              }}
            >
              {/* Component Header */}
              <div
                className="px-[var(--report-space-md)] py-[var(--report-space-sm)] flex items-center justify-between gap-4 flex-wrap"
                style={{
                  borderBottom: '1px solid rgba(27, 46, 74, 0.06)',
                  backgroundColor: 'white',
                }}
              >
                <h3
                  className="text-base font-semibold"
                  style={{
                    fontFamily: 'var(--report-font-display)',
                    color: 'var(--report-navy)',
                  }}
                >
                  {label}
                </h3>
                <div className="flex items-center gap-4 flex-wrap">
                  {markets.map((market) => (
                    <ComponentScoreBadge
                      key={market.id}
                      component={componentName}
                      score={market.componentScore}
                      label={market.name}
                      status={market.componentStatus}
                      compact
                    />
                  ))}
                </div>
              </div>

              {/* Metrics Table */}
              {metrics.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: '1px solid rgba(27, 46, 74, 0.06)',
                        }}
                      >
                        <th
                          className="text-left px-[var(--report-space-md)] py-[var(--report-space-sm)] text-[0.6875rem] font-medium uppercase tracking-[0.04em]"
                          style={{ color: 'var(--report-stone-light)' }}
                        >
                          Metric
                        </th>
                        {markets.map((market) => (
                          <th
                            key={market.id}
                            className="text-right px-[var(--report-space-md)] py-[var(--report-space-sm)] text-[0.6875rem] font-medium uppercase tracking-[0.04em]"
                            style={{
                              color:
                                market.id === winnerId
                                  ? 'var(--report-success)'
                                  : 'var(--report-stone-light)',
                              backgroundColor:
                                market.id === winnerId
                                  ? 'var(--report-success-bg)'
                                  : 'transparent',
                            }}
                          >
                            {market.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((metric, idx) => {
                        // Gather values for all markets
                        const values: (number | null)[] = markets.map((market) => {
                          if (market.id === report.primary_geography_id) {
                            return getMetricValueWithAliases(report as any, metric.metricId);
                          }
                          // Comparison market
                          const compData = comparisons?.[market.id];
                          return getCompMetricValue(compData, metric.metricId);
                        });

                        return (
                          <tr
                            key={metric.metricId + '-' + idx}
                            style={{
                              borderBottom:
                                idx < metrics.length - 1
                                  ? '1px solid rgba(27, 46, 74, 0.04)'
                                  : 'none',
                            }}
                          >
                            <td
                              className="px-[var(--report-space-md)] py-[var(--report-space-sm)]"
                              style={{ color: 'var(--report-stone)' }}
                            >
                              {metric.label}
                            </td>
                            {markets.map((market, mIdx) => {
                              const val = values[mIdx];
                              const isWinnerCol = market.id === winnerId;
                              return (
                                <td
                                  key={market.id}
                                  className="text-right px-[var(--report-space-md)] py-[var(--report-space-sm)] font-medium"
                                  style={{
                                    color: 'var(--report-navy)',
                                    fontFamily: 'var(--report-font-display)',
                                    backgroundColor: isWinnerCol
                                      ? 'var(--report-success-bg)'
                                      : 'transparent',
                                  }}
                                >
                                  {val !== null
                                    ? formatMetricValue(val, metric.format)
                                    : '\u2014'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* AI Narrative (optional) */}
              {narrative && (
                <div className="px-[var(--report-space-md)] pb-[var(--report-space-md)]">
                  <AIAnalysisBlock content={narrative} variant="insight" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export default ComponentShowdown;
