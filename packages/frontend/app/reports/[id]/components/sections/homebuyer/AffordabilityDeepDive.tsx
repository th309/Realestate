'use client';

import React from 'react';
import { DollarSign } from 'lucide-react';

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
import { calculatePITI } from '../../utils/affordabilityCalc';
import type { ReportInstance } from '../../../../types';

export interface AffordabilityDeepDiveProps {
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
 * AffordabilityDeepDive - Component deep dive for the Affordability score component.
 *
 * Displays the affordability score badge, key metrics (price, income, ratio, PITI),
 * historical trend, AI narrative, personalized insights, and partner recommendations.
 */
export function AffordabilityDeepDive({
  report,
}: AffordabilityDeepDiveProps): React.ReactElement {
  const component = findComponent(report, 'affordability');

  // -- Metrics --
  const medianPrice = getMetricValueWithAliases(report as any, 'median_listing_price', [
    'zhvi',
    'home_value',
  ]);
  const medianIncome = getMetricWithAliases(report as any, 'median_income');
  const affordabilityRatio = getMetricWithAliases(report as any, 'affordability_ratio');
  const calculatedRatio =
    affordabilityRatio ??
    (medianPrice && medianIncome && medianIncome > 0
      ? Math.round((medianPrice / medianIncome) * 10) / 10
      : null);
  const estimatedPiti = medianPrice
    ? Math.round(calculatePITI({ price: medianPrice }).monthlyPITI)
    : null;

  // -- Benchmarks --
  const nationalBenchmarks = report.populated_data?.benchmarks?.national;
  const nationalPrice =
    nationalBenchmarks?.median_listing_price ??
    nationalBenchmarks?.zhvi ??
    nationalBenchmarks?.home_value ??
    null;
  const nationalIncome = nationalBenchmarks?.median_income ?? null;

  // -- Build metric items --
  const metrics: MetricItem[] = [];

  metrics.push({
    label: 'Median Home Price',
    value: medianPrice,
    format: 'currency',
    benchmark: nationalPrice != null ? { label: 'National', value: nationalPrice } : undefined,
  });

  metrics.push({
    label: 'Median Income',
    value: medianIncome,
    format: 'currency',
    benchmark: nationalIncome != null ? { label: 'National', value: nationalIncome } : undefined,
  });

  metrics.push({
    label: 'Price-to-Income',
    value: calculatedRatio,
    format: 'number',
  });

  metrics.push({
    label: 'Est. Monthly PITI',
    value: estimatedPiti,
    format: 'currency',
  });

  // -- Trend data --
  const historicalRaw =
    report.populated_data?.historical?.affordability_ratio ??
    report.populated_data?.historical?.zhvi ??
    report.populated_data?.historical?.home_value;

  // -- AI Narrative --
  const narrative =
    report.ai_narrative?.affordability_narrative ??
    report.ai_narrative?.affordability_analysis;

  // -- Personalized --
  const userIncome = report.user_inputs?.income;
  const personalizedContent =
    report.ai_narrative?.affordability_personalized ??
    (userIncome && medianPrice
      ? `With your reported income of ${formatMetricValue(userIncome, 'currency')}, the local price-to-income ratio for you is ${(medianPrice / userIncome).toFixed(1)}x. ` +
        `Financial advisors generally recommend a ratio below 4.0x for comfortable homeownership.`
      : undefined);
  const personalizedInputs: string[] = [];
  if (report.user_inputs?.income) personalizedInputs.push('income');
  if (report.user_inputs?.down_payment) personalizedInputs.push('down_payment');

  // -- Score badge --
  const score = component?.score ?? null;
  const status: ComponentStatus = component?.status ?? 'moderate';

  const hasAnyData =
    score !== null || metrics.some((m) => m.value !== null) || narrative;

  if (!hasAnyData) {
    return (
      <SectionCard title="Affordability" icon={DollarSign}>
        <div className="flex items-center justify-center py-12">
          <p
            className="text-sm"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Affordability data is not yet available for this market.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Affordability" icon={DollarSign}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* Component Score Badge */}
        {score !== null && (
          <ComponentScoreBadge
            component="affordability"
            score={score}
            label={`Affordability: ${score}/100`}
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
                Affordability Trend
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
                    {report.populated_data?.historical?.affordability_ratio
                      ? 'Price-to-Income Ratio'
                      : 'Home Values'}
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
                    {formatMetricValue(
                      historicalRaw.data[0].value,
                      report.populated_data?.historical?.affordability_ratio
                        ? 'number'
                        : 'currency'
                    )}
                  </span>
                  <span>
                    {formatMetricValue(
                      historicalRaw.data[historicalRaw.data.length - 1].value,
                      report.populated_data?.historical?.affordability_ratio
                        ? 'number'
                        : 'currency'
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
            title="Affordability Analysis"
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
        <RecommendationSlot contextType="affordability" report={report} />
      </div>
    </SectionCard>
  );
}

export default AffordabilityDeepDive;
