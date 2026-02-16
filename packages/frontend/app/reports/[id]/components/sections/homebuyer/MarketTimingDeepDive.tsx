'use client';

import React from 'react';
import { Clock } from 'lucide-react';

import type { ComponentStatus, ScoreComponentBreakdown } from '@/lib/data';
import {
  SectionCard,
  ComponentScoreBadge,
  MetricsRow,
  AIAnalysisBlock,
  TrendSparkline,
  PersonalizedInsight,
  RecommendationSlot,
} from '../core';
import type { MetricItem } from '../core';
import {
  getMetricWithAliases,
  getMetricValueWithAliases,
} from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

export interface MarketTimingDeepDiveProps {
  report: ReportInstance;
}

/**
 * Find a specific component from the homeready_components array.
 */
function findComponent(
  report: ReportInstance,
  componentName: string
): ScoreComponentBreakdown | undefined {
  const components = (report.scores_snapshot as any)
    ?.homeready_components as ScoreComponentBreakdown[] | undefined;
  return components?.find((c) => c.component === componentName);
}

/**
 * MarketTimingDeepDive - Component deep dive for the Market Timing score component.
 *
 * Displays the market timing score badge, key metrics (days on market, active listings,
 * hotness score, pending ratio), historical trend, AI narrative, and partner recommendations.
 */
export function MarketTimingDeepDive({
  report,
}: MarketTimingDeepDiveProps): React.ReactElement {
  const component = findComponent(report, 'market_timing');

  // -- Metrics --
  const daysOnMarket = getMetricValueWithAliases(report as any, 'days_on_market', [
    'median_days_on_market',
  ]);
  const activeListings = getMetricValueWithAliases(report as any, 'active_listing_count', [
    'for_sale_inventory',
  ]);
  const hotnessScore = getMetricWithAliases(report as any, 'hotness_score');
  const pendingRatio = getMetricWithAliases(report as any, 'pending_ratio');

  // -- Benchmarks --
  const nationalBenchmarks = report.populated_data?.benchmarks?.national;
  const nationalDOM =
    nationalBenchmarks?.days_on_market ??
    nationalBenchmarks?.median_days_on_market ??
    null;
  const nationalListings =
    nationalBenchmarks?.active_listing_count ??
    nationalBenchmarks?.for_sale_inventory ??
    null;

  // -- Build metric items --
  const metrics: MetricItem[] = [];

  metrics.push({
    label: 'Days on Market',
    value: daysOnMarket,
    format: 'days',
    benchmark: nationalDOM != null ? { label: 'National', value: nationalDOM } : undefined,
  });

  metrics.push({
    label: 'Active Listings',
    value: activeListings,
    format: 'number',
    benchmark:
      nationalListings != null ? { label: 'National', value: nationalListings } : undefined,
  });

  metrics.push({
    label: 'Hotness Score',
    value: hotnessScore,
    format: 'number',
  });

  metrics.push({
    label: 'Pending Ratio',
    value: pendingRatio,
    format: 'percent',
  });

  // -- Trend data --
  const historicalRaw =
    report.populated_data?.historical?.days_on_market ??
    report.populated_data?.historical?.median_days_on_market;

  // -- AI Narrative --
  const narrative = report.ai_narrative?.market_timing_narrative;

  // -- Personalized --
  const timeline = report.user_inputs?.timeline;
  const personalizedContent =
    report.ai_narrative?.market_timing_personalized ??
    (timeline
      ? `Based on your ${timeline} buying timeline, ${
          daysOnMarket !== null && daysOnMarket < 30
            ? 'this is a fast-moving market. Homes sell quickly, so being pre-approved and ready to act will be important.'
            : daysOnMarket !== null && daysOnMarket > 60
              ? 'this market gives you time to be selective. Homes are sitting longer, giving you negotiation leverage.'
              : 'this market is moving at a moderate pace, giving you a balanced opportunity to find the right home.'
        }`
      : undefined);
  const personalizedInputs: string[] = [];
  if (timeline) personalizedInputs.push('timeline');

  // -- Score badge --
  const score = component?.score ?? null;
  const status: ComponentStatus = component?.status ?? 'moderate';

  const hasAnyData =
    score !== null || metrics.some((m) => m.value !== null) || narrative;

  if (!hasAnyData) {
    return (
      <SectionCard title="Market Timing" icon={Clock}>
        <div className="flex items-center justify-center py-12">
          <p
            className="text-sm"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Market timing data is not yet available for this market.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Market Timing" icon={Clock}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* Component Score Badge */}
        {score !== null && (
          <ComponentScoreBadge
            component="market_timing"
            score={score}
            label={`Market Timing: ${score}/100`}
            status={status}
          />
        )}

        {/* Metrics Row */}
        {metrics.some((m) => m.value !== null) && <MetricsRow metrics={metrics} />}

        {/* Historical Trend */}
        {historicalRaw &&
          historicalRaw.data &&
          historicalRaw.data.length >= 2 && (
            <div>
              <h4 className="report-label mb-[var(--report-space-md)]">
                Days on Market Trend
              </h4>
              <div
                className="p-4 rounded-lg"
                style={{ backgroundColor: 'var(--report-cream)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--report-navy)' }}
                  >
                    Days on Market
                  </p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      historicalRaw.trend === 'up'
                        ? 'bg-[var(--report-warning-bg)] text-[var(--report-warning)]'
                        : historicalRaw.trend === 'down'
                          ? 'bg-[var(--report-success-bg)] text-[var(--report-success)]'
                          : 'bg-[var(--report-cream-dark)] text-[var(--report-stone)]'
                    }`}
                  >
                    {historicalRaw.change_pct >= 0 ? '+' : ''}
                    {historicalRaw.change_pct.toFixed(0)}%
                  </span>
                </div>
                <TrendSparkline
                  data={historicalRaw.data.map(
                    (d: { value: number }) => d.value
                  )}
                  trend={historicalRaw.trend}
                  changePct={historicalRaw.change_pct}
                  width={200}
                  height={40}
                />
                <div
                  className="flex justify-between mt-2 text-xs"
                  style={{ color: 'var(--report-stone-light)' }}
                >
                  <span>{Math.round(historicalRaw.data[0].value)} days</span>
                  <span>
                    {Math.round(
                      historicalRaw.data[historicalRaw.data.length - 1].value
                    )}{' '}
                    days
                  </span>
                </div>
              </div>
            </div>
          )}

        {/* AI Narrative */}
        {narrative && (
          <AIAnalysisBlock
            content={narrative}
            title="Market Timing Analysis"
            variant="insight"
          />
        )}

        {/* Personalized Insight */}
        {personalizedContent && (
          <PersonalizedInsight
            content={personalizedContent}
            inputsUsed={personalizedInputs}
          />
        )}

        {/* Partner Recommendation */}
        <RecommendationSlot contextType="timing" report={report} />
      </div>
    </SectionCard>
  );
}

export default MarketTimingDeepDive;
