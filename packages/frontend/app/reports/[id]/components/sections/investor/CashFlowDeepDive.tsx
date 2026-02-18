'use client';

import React from 'react';
import { Wallet } from 'lucide-react';

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

export interface CashFlowDeepDiveProps {
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
 * CashFlowDeepDive - Component deep dive for the Cash Flow score component.
 *
 * Displays the cash flow score badge, key metrics (cap rate, gross yield,
 * GRM, rent index), historical rent trend, AI narrative, personalized
 * net cash flow estimate, and partner recommendations.
 */
export function CashFlowDeepDive({
  report,
}: CashFlowDeepDiveProps): React.ReactElement {
  const component = findComponent(report, 'cash_flow');

  // -- Metrics --
  const capRate = getMetricWithAliases(report as any, 'cap_rate');
  const grossYield = getMetricWithAliases(report as any, 'gross_yield');
  const grm = getMetricValueWithAliases(report as any, 'grm', [
    'gross_rent_multiplier',
  ]);
  const rentIndex = getMetricValueWithAliases(report as any, 'zori', [
    'rent_index',
    'median_gross_rent',
  ]);

  // -- Benchmarks --
  const nationalBenchmarks = report.populated_data?.benchmarks?.national;
  const nationalCapRate = nationalBenchmarks?.cap_rate ?? null;

  // -- Build metric items --
  const metrics: MetricItem[] = [];

  metrics.push({
    label: 'Cap Rate',
    value: capRate,
    format: 'percent',
    benchmark:
      nationalCapRate != null
        ? { label: 'National', value: nationalCapRate }
        : undefined,
  });

  metrics.push({
    label: 'Gross Yield',
    value: grossYield,
    format: 'percent',
  });

  metrics.push({
    label: 'GRM',
    value: grm,
    format: 'number',
  });

  metrics.push({
    label: 'Rent Index',
    value: rentIndex,
    format: 'currency',
  });

  // -- Trend data --
  const historicalRaw =
    report.populated_data?.historical?.zori ??
    report.populated_data?.historical?.median_gross_rent;

  // -- AI Narrative --
  const narrative = report.ai_narrative?.cash_flow_narrative ?? report.ai_narrative?.cash_flow_analysis;

  // -- Personalized --
  const investmentBudget = report.user_inputs?.investment_budget;
  const personalizedContent =
    report.ai_narrative?.cash_flow_personalized ??
    (investmentBudget && rentIndex && capRate
      ? `With an investment budget of ${formatMetricValue(investmentBudget, 'currency')}, ` +
        `a property at this price point could generate approximately ` +
        `${formatMetricValue(Math.round((investmentBudget * (capRate / 100)) / 12), 'currency')}/month in estimated net cash flow ` +
        `based on the local cap rate of ${formatMetricValue(capRate, 'percent')}.`
      : investmentBudget && rentIndex
        ? `With an investment budget of ${formatMetricValue(investmentBudget, 'currency')} and ` +
          `local rents around ${formatMetricValue(rentIndex, 'currency')}/month, ` +
          `you can estimate your potential monthly cash flow after accounting for mortgage, taxes, and expenses.`
        : undefined);
  const personalizedInputs: string[] = [];
  if (investmentBudget) personalizedInputs.push('investment_budget');

  // -- Score badge --
  const score = component?.score ?? null;
  const status: ComponentStatus = component?.status ?? 'moderate';

  const hasAnyData =
    score !== null || metrics.some((m) => m.value !== null) || narrative;

  if (!hasAnyData) {
    return (
      <SectionCard title="Cash Flow" icon={Wallet}>
        <div className="flex items-center justify-center py-12">
          <p
            className="text-sm"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Cash flow data is not yet available for this market.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Cash Flow" icon={Wallet}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* Component Score Badge */}
        {score !== null && (
          <ComponentScoreBadge
            component="cash_flow"
            score={score}
            label={`Cash Flow: ${score}/100`}
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
                Rent Trend
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
            title="Cash Flow Analysis"
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

export default CashFlowDeepDive;
