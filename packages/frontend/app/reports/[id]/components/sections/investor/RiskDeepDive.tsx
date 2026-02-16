'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

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

export interface RiskDeepDiveProps {
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
 * Interpret risk tolerance against market risk metrics.
 */
function interpretRiskTolerance(
  tolerance: string,
  overvaluedPct: number | null,
  vacancyRate: number | null
): string {
  const riskLevel =
    tolerance === 'aggressive' || tolerance === 'high'
      ? 'high'
      : tolerance === 'moderate' || tolerance === 'medium'
        ? 'moderate'
        : 'low';

  const factors: string[] = [];

  if (overvaluedPct !== null) {
    if (overvaluedPct > 10) {
      factors.push(
        `the market shows ${formatMetricValue(overvaluedPct, 'percent')} overvaluation`
      );
    } else if (overvaluedPct < -5) {
      factors.push('the market appears undervalued, which may reduce downside risk');
    } else {
      factors.push('valuation appears close to fair market value');
    }
  }

  if (vacancyRate !== null) {
    if (vacancyRate > 8) {
      factors.push(`vacancy rates are elevated at ${formatMetricValue(vacancyRate, 'percent')}`);
    } else if (vacancyRate < 4) {
      factors.push('low vacancy indicates strong rental demand');
    }
  }

  const factorStr = factors.length > 0 ? ` Key considerations: ${factors.join('; ')}.` : '';

  if (riskLevel === 'high') {
    return `Your high risk tolerance gives you flexibility in this market.${factorStr}`;
  }
  if (riskLevel === 'low') {
    return `With your conservative risk profile, pay close attention to downside indicators.${factorStr}`;
  }
  return `Your moderate risk tolerance suggests a balanced approach.${factorStr}`;
}

/**
 * RiskDeepDive - Component deep dive for the Risk score component.
 *
 * Displays the risk score badge, key risk metrics (overvaluation, days on market,
 * vacancy rate, unemployment rate), historical price volatility context, AI narrative,
 * personalized risk assessment, and partner recommendations.
 */
export function RiskDeepDive({
  report,
}: RiskDeepDiveProps): React.ReactElement {
  const component = findComponent(report, 'risk');

  // -- Metrics --
  const overvaluedPct = getMetricWithAliases(report as any, 'overvalued_pct');
  const daysOnMarket = getMetricValueWithAliases(report as any, 'days_on_market', [
    'median_days_on_market',
  ]);
  const vacancyRate = getMetricWithAliases(report as any, 'vacancy_rate');
  const unemploymentRate = getMetricWithAliases(report as any, 'unemployment_rate');

  // -- Benchmarks --
  const nationalBenchmarks = report.populated_data?.benchmarks?.national;
  const nationalUnemployment = nationalBenchmarks?.unemployment_rate ?? null;

  // -- Build metric items --
  const metrics: MetricItem[] = [];

  metrics.push({
    label: 'Overvaluation %',
    value: overvaluedPct,
    format: 'percent',
  });

  metrics.push({
    label: 'Days on Market',
    value: daysOnMarket,
    format: 'number',
  });

  metrics.push({
    label: 'Vacancy Rate',
    value: vacancyRate,
    format: 'percent',
  });

  metrics.push({
    label: 'Unemployment Rate',
    value: unemploymentRate,
    format: 'percent',
    benchmark:
      nationalUnemployment != null
        ? { label: 'National', value: nationalUnemployment }
        : undefined,
  });

  // -- Trend data (price volatility context) --
  const historicalRaw =
    report.populated_data?.historical?.zhvi ??
    report.populated_data?.historical?.home_value;

  // -- AI Narrative --
  const narrative = report.ai_narrative?.risk_narrative;

  // -- Personalized --
  const riskTolerance = report.user_inputs?.risk_tolerance;
  const personalizedContent =
    report.ai_narrative?.risk_personalized ??
    (riskTolerance
      ? interpretRiskTolerance(riskTolerance, overvaluedPct, vacancyRate)
      : undefined);

  const personalizedInputs: string[] = [];
  if (report.user_inputs?.risk_tolerance) personalizedInputs.push('risk_tolerance');

  // -- Score badge --
  const score = component?.score ?? null;
  const status: ComponentStatus = component?.status ?? 'moderate';

  const hasAnyData =
    score !== null || metrics.some((m) => m.value !== null) || narrative;

  if (!hasAnyData) {
    return (
      <SectionCard title="Risk Assessment" icon={AlertTriangle}>
        <div className="flex items-center justify-center py-12">
          <p
            className="text-sm"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Risk assessment data is not yet available for this market.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Risk Assessment" icon={AlertTriangle}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* Component Score Badge */}
        {score !== null && (
          <ComponentScoreBadge
            component="risk"
            score={score}
            label={`Risk: ${score}/100`}
            status={status}
          />
        )}

        {/* Metrics Row */}
        {metrics.some((m) => m.value !== null) && <MetricsRow metrics={metrics} />}

        {/* Historical Trend (price volatility context) */}
        {historicalRaw &&
          historicalRaw.data &&
          historicalRaw.data.length >= 2 && (
            <div>
              <h4 className="report-label mb-[var(--report-space-md)]">
                Price Volatility Context
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
            title="Risk Analysis"
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
        <RecommendationSlot contextType="risk" report={report} />
      </div>
    </SectionCard>
  );
}

export default RiskDeepDive;
