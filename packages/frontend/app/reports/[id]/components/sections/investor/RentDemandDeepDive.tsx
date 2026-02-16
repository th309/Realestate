'use client';

import React from 'react';
import { Users } from 'lucide-react';

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

export interface RentDemandDeepDiveProps {
  report: ReportInstance;
}

/**
 * Find a specific component from the investoredge_components array.
 */
function findComponent(
  report: ReportInstance,
  componentName: string
): ScoreComponentBreakdown | undefined {
  const components = report.scores_snapshot
    ?.investoredge_components;
  return components?.find((c) => c.component === componentName);
}

/**
 * RentDemandDeepDive - Component deep dive for the Rent Demand score component.
 *
 * Displays the rent demand score badge, key metrics (rent YoY, vacancy rate,
 * pending ratio, population growth), historical rent growth trend, AI narrative,
 * strategy-contextualized personalized insight, and partner recommendations.
 */
export function RentDemandDeepDive({
  report,
}: RentDemandDeepDiveProps): React.ReactElement {
  const component = findComponent(report, 'rent_demand');

  // -- Metrics --
  const rentYoY = getMetricValueWithAliases(report as any, 'rent_yoy', [
    'zori_yoy',
  ]);
  const vacancyRate = getMetricWithAliases(report as any, 'vacancy_rate');
  const pendingRatio = getMetricWithAliases(report as any, 'pending_ratio');
  const populationGrowth = getMetricValueWithAliases(
    report as any,
    'population_yoy',
    ['population_growth_yoy', 'population_growth']
  );

  // -- Benchmarks --
  const nationalBenchmarks = report.populated_data?.benchmarks?.national;
  const nationalRentYoY =
    nationalBenchmarks?.rent_yoy ?? nationalBenchmarks?.zori_yoy ?? null;
  const nationalPopGrowth =
    nationalBenchmarks?.population_yoy ??
    nationalBenchmarks?.population_growth_yoy ??
    nationalBenchmarks?.population_growth ??
    null;

  // -- Build metric items --
  const metrics: MetricItem[] = [];

  metrics.push({
    label: 'Rent YoY',
    value: rentYoY,
    format: 'percent',
    benchmark:
      nationalRentYoY != null
        ? { label: 'National', value: nationalRentYoY }
        : undefined,
  });

  metrics.push({
    label: 'Vacancy Rate',
    value: vacancyRate,
    format: 'percent',
  });

  metrics.push({
    label: 'Pending Ratio',
    value: pendingRatio,
    format: 'percent',
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

  // -- Trend data --
  const historicalRaw =
    report.populated_data?.historical?.zori ??
    report.populated_data?.historical?.median_gross_rent;

  // -- AI Narrative --
  const narrative = report.ai_narrative?.rent_demand_narrative;

  // -- Personalized --
  const investmentStrategy = report.user_inputs?.strategy;
  const personalizedContent =
    report.ai_narrative?.rent_demand_personalized ??
    (investmentStrategy
      ? investmentStrategy === 'flip' || investmentStrategy === 'fix_and_flip'
        ? `As a fix-and-flip investor, rent demand signals how quickly you can pivot to a rental hold ` +
          `if the resale market softens. ${
            vacancyRate !== null && vacancyRate < 5
              ? 'With vacancy below 5%, this market offers a strong safety net for your exit strategy.'
              : vacancyRate !== null && vacancyRate > 8
                ? 'Higher vacancy rates here mean you should plan conservatively for your holding period.'
                : 'Moderate vacancy rates provide reasonable flexibility for your strategy.'
          }`
        : `For a buy-and-hold strategy, rent demand is critical to sustained cash flow. ${
            rentYoY !== null && rentYoY > 3
              ? `Rents are growing at ${formatMetricValue(rentYoY, 'percent')} year-over-year, supporting increasing returns over time.`
              : rentYoY !== null && rentYoY < 0
                ? 'Declining rents may pressure your cash flow projections in the near term.'
                : 'Rent growth is moderate, suggesting stable but not exceptional cash flow growth.'
          }`
      : undefined);
  const personalizedInputs: string[] = [];
  if (investmentStrategy) personalizedInputs.push('investment_strategy');

  // -- Score badge --
  const score = component?.score ?? null;
  const status: ComponentStatus = component?.status ?? 'moderate';

  const hasAnyData =
    score !== null || metrics.some((m) => m.value !== null) || narrative;

  if (!hasAnyData) {
    return (
      <SectionCard title="Rent Demand" icon={Users}>
        <div className="flex items-center justify-center py-12">
          <p
            className="text-sm"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Rent demand data is not yet available for this market.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Rent Demand" icon={Users}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* Component Score Badge */}
        {score !== null && (
          <ComponentScoreBadge
            component="rent_demand"
            score={score}
            label={`Rent Demand: ${score}/100`}
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
                Rent Growth Trend
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
                    Rent Index
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
            title="Rent Demand Analysis"
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
        <RecommendationSlot contextType="cash_flow" report={report} />
      </div>
    </SectionCard>
  );
}

export default RentDemandDeepDive;
