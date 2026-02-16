'use client';

import React from 'react';
import { Shield } from 'lucide-react';

import { formatMetricValue } from '@/lib/data';
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

export interface StabilityDeepDiveProps {
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
 * StabilityDeepDive - Component deep dive for the Stability score component.
 *
 * Displays the stability score badge, key metrics (home value YoY, days on market,
 * supply score, price cuts), historical price trend, AI narrative, personalized
 * insights, and partner recommendations.
 */
export function StabilityDeepDive({
  report,
}: StabilityDeepDiveProps): React.ReactElement {
  const component = findComponent(report, 'stability');

  // -- Metrics --
  const homeValueYoY = getMetricValueWithAliases(report as any, 'home_value_yoy', [
    'zhvi_yoy',
  ]);
  const daysOnMarket = getMetricValueWithAliases(report as any, 'days_on_market', [
    'median_days_on_market',
  ]);
  const supplyScore = getMetricWithAliases(report as any, 'supply_score');
  const priceCuts = getMetricValueWithAliases(report as any, 'price_cut_pct', [
    'price_reduced_share',
  ]);

  // -- Benchmarks --
  const nationalBenchmarks = report.populated_data?.benchmarks?.national;
  const nationalYoY =
    nationalBenchmarks?.home_value_yoy ??
    nationalBenchmarks?.zhvi_yoy ??
    null;
  const nationalPriceCuts =
    nationalBenchmarks?.price_cut_pct ??
    nationalBenchmarks?.price_reduced_share ??
    null;

  // -- Build metric items --
  const metrics: MetricItem[] = [];

  metrics.push({
    label: 'Home Value YoY',
    value: homeValueYoY,
    format: 'percent',
    benchmark: nationalYoY != null ? { label: 'National', value: nationalYoY } : undefined,
  });

  metrics.push({
    label: 'Days on Market',
    value: daysOnMarket,
    format: 'days',
  });

  metrics.push({
    label: 'Supply Score',
    value: supplyScore,
    format: 'number',
  });

  metrics.push({
    label: 'Price Cuts',
    value: priceCuts,
    format: 'percent',
    benchmark:
      nationalPriceCuts != null
        ? { label: 'National', value: nationalPriceCuts }
        : undefined,
  });

  // -- Trend data (price stability over time) --
  const historicalRaw =
    report.populated_data?.historical?.zhvi ??
    report.populated_data?.historical?.home_value;

  // -- AI Narrative --
  const narrative = report.ai_narrative?.stability_narrative;

  // -- Personalized --
  const riskTolerance = report.user_inputs?.risk_tolerance;
  const firstTimeBuyer = report.user_inputs?.first_time_buyer;
  const personalizedContent =
    report.ai_narrative?.stability_personalized ??
    (firstTimeBuyer
      ? 'As a first-time buyer, market stability is especially important. A stable market reduces the risk of buying at a peak and seeing your home value decline shortly after purchase.'
      : riskTolerance === 'low'
        ? 'Given your low risk tolerance, this stability assessment is particularly relevant. Stable markets tend to preserve home equity better during economic downturns.'
        : undefined);
  const personalizedInputs: string[] = [];
  if (firstTimeBuyer) personalizedInputs.push('first_time_buyer');
  if (riskTolerance) personalizedInputs.push('risk_tolerance');

  // -- Score badge --
  const score = component?.score ?? null;
  const status: ComponentStatus = component?.status ?? 'moderate';

  const hasAnyData =
    score !== null || metrics.some((m) => m.value !== null) || narrative;

  if (!hasAnyData) {
    return (
      <SectionCard title="Stability" icon={Shield}>
        <div className="flex items-center justify-center py-12">
          <p
            className="text-sm"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Stability data is not yet available for this market.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Stability" icon={Shield}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* Component Score Badge */}
        {score !== null && (
          <ComponentScoreBadge
            component="stability"
            score={score}
            label={`Stability: ${score}/100`}
            status={status}
          />
        )}

        {/* Metrics Row */}
        {metrics.some((m) => m.value !== null) && <MetricsRow metrics={metrics} />}

        {/* Historical Trend - Price Stability */}
        {historicalRaw &&
          historicalRaw.data &&
          historicalRaw.data.length >= 2 && (
            <div>
              <h4 className="report-label mb-[var(--report-space-md)]">
                Price Stability Trend
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
                    Home Values
                  </p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      historicalRaw.trend === 'up'
                        ? 'bg-[var(--report-success-bg)] text-[var(--report-success)]'
                        : historicalRaw.trend === 'down'
                          ? 'bg-[var(--report-error-bg)] text-[var(--report-error)]'
                          : 'bg-[var(--report-cream-dark)] text-[var(--report-stone)]'
                    }`}
                  >
                    {historicalRaw.change_pct >= 0 ? '+' : ''}
                    {historicalRaw.change_pct.toFixed(1)}%
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
                  <span>
                    {formatMetricValue(historicalRaw.data[0].value, 'currency')}
                  </span>
                  <span>
                    {formatMetricValue(
                      historicalRaw.data[historicalRaw.data.length - 1].value,
                      'currency'
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

        {/* AI Narrative */}
        {narrative && (
          <AIAnalysisBlock
            content={narrative}
            title="Stability Analysis"
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
        <RecommendationSlot contextType="stability" report={report} />
      </div>
    </SectionCard>
  );
}

export default StabilityDeepDive;
