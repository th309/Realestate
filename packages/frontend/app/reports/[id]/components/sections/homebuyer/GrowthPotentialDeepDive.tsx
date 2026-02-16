'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';

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
  getScoreContext,
} from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

export interface GrowthPotentialDeepDiveProps {
  report: ReportInstance;
}

/**
 * Find a specific component from the homeready_components array.
 */
function findComponent(
  report: ReportInstance,
  componentName: string
): ScoreComponentBreakdown | undefined {
  const components = report.scores_snapshot
    ?.homeready_components;
  return components?.find((c) => c.component === componentName);
}

/**
 * GrowthPotentialDeepDive - Component deep dive for the Growth Potential score component.
 *
 * Displays the growth potential score badge, key metrics (home value YoY, population growth,
 * job growth, hotness), historical home value trend, dollar impact backtesting,
 * AI narrative, personalized insights, and partner recommendations.
 */
export function GrowthPotentialDeepDive({
  report,
}: GrowthPotentialDeepDiveProps): React.ReactElement {
  const component = findComponent(report, 'growth_potential');

  // -- Metrics --
  const homeValueYoY = getMetricValueWithAliases(report as any, 'home_value_yoy', [
    'zhvi_yoy',
  ]);
  const populationGrowth = getMetricValueWithAliases(report as any, 'population_yoy', [
    'population_growth_yoy',
    'population_growth',
  ]);
  const jobGrowth = getMetricValueWithAliases(report as any, 'job_growth_yoy', [
    'unemployment_rate_yoy',
    'job_growth',
  ]);
  const hotnessScore = getMetricWithAliases(report as any, 'hotness_score');

  // -- Benchmarks --
  const nationalBenchmarks = report.populated_data?.benchmarks?.national;
  const nationalYoY =
    nationalBenchmarks?.home_value_yoy ??
    nationalBenchmarks?.zhvi_yoy ??
    null;
  const nationalPopGrowth =
    nationalBenchmarks?.population_yoy ??
    nationalBenchmarks?.population_growth_yoy ??
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
    label: 'Population Growth',
    value: populationGrowth,
    format: 'percent',
    benchmark:
      nationalPopGrowth != null
        ? { label: 'National', value: nationalPopGrowth }
        : undefined,
  });

  metrics.push({
    label: 'Job Growth',
    value: jobGrowth,
    format: 'percent',
  });

  metrics.push({
    label: 'Hotness Score',
    value: hotnessScore,
    format: 'number',
  });

  // -- Trend data --
  const historicalRaw =
    report.populated_data?.historical?.zhvi ??
    report.populated_data?.historical?.home_value;

  // -- Dollar Impact / Backtesting --
  const scoreContext = getScoreContext(report as any, 'homeready');

  // -- AI Narrative --
  const narrative = report.ai_narrative?.growth_potential_narrative;

  // -- Personalized --
  const budget = report.user_inputs?.investment_budget ?? report.user_inputs?.down_payment;
  const personalizedContent =
    report.ai_narrative?.growth_potential_personalized ??
    (budget && homeValueYoY !== null
      ? `Based on recent appreciation rates of ${homeValueYoY.toFixed(1)}% annually, a home purchased at your budget level could see approximately ${formatMetricValue(
          Math.round(budget * (homeValueYoY / 100)),
          'currency'
        )} in equity growth over the next year, all else being equal.`
      : undefined);
  const personalizedInputs: string[] = [];
  if (report.user_inputs?.investment_budget) personalizedInputs.push('investment_budget');
  if (report.user_inputs?.down_payment) personalizedInputs.push('down_payment');
  if (report.user_inputs?.income) personalizedInputs.push('income');

  // -- Score badge --
  const score = component?.score ?? null;
  const status: ComponentStatus = component?.status ?? 'moderate';

  const hasAnyData =
    score !== null || metrics.some((m) => m.value !== null) || narrative;

  if (!hasAnyData) {
    return (
      <SectionCard title="Growth Potential" icon={TrendingUp}>
        <div className="flex items-center justify-center py-12">
          <p
            className="text-sm"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Growth potential data is not yet available for this market.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Growth Potential" icon={TrendingUp}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* Component Score Badge */}
        {score !== null && (
          <ComponentScoreBadge
            component="growth_potential"
            score={score}
            label={`Growth Potential: ${score}/100`}
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
                Home Value Growth Trend
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

        {/* Dollar Impact Card */}
        {scoreContext?.dollarImpact && (
          <div
            className="p-[var(--report-space-lg)] rounded-[var(--report-radius-md)]"
            style={{
              backgroundColor: 'var(--report-success-bg)',
              border: '1px solid rgba(27, 46, 74, 0.04)',
            }}
          >
            <p
              className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] mb-[var(--report-space-sm)]"
              style={{ color: 'var(--report-stone-light)' }}
            >
              Dollar Impact (Backtested)
            </p>
            <p
              className="text-[0.9375rem] leading-relaxed font-medium"
              style={{ color: 'var(--report-success)' }}
            >
              {scoreContext.dollarImpact}
            </p>
            {scoreContext.percentileText && (
              <p
                className="text-[0.75rem] mt-[var(--report-space-sm)]"
                style={{ color: 'var(--report-stone)' }}
              >
                {scoreContext.percentileText}
              </p>
            )}
          </div>
        )}

        {/* AI Narrative */}
        {narrative && (
          <AIAnalysisBlock
            content={narrative}
            title="Growth Potential Analysis"
            variant="insight"
          />
        )}

        {/* Personalized Insight */}
        {personalizedContent && (
          <PersonalizedInsight
            content={personalizedContent}
            inputsUsed={personalizedInputs.filter(
              (input) => report.user_inputs?.[input] != null
            )}
          />
        )}

        {/* Partner Recommendation */}
        <RecommendationSlot contextType="growth" report={report} />
      </div>
    </SectionCard>
  );
}

export default GrowthPotentialDeepDive;
