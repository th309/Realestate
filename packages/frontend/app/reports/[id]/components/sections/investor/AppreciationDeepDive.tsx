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
} from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

export interface AppreciationDeepDiveProps {
  report: ReportInstance;
}

/**
 * Find a specific component from the investoredge_components array.
 */
function findComponent(
  report: ReportInstance,
  componentName: string
): ScoreComponentBreakdown | undefined {
  const components = (report.scores_snapshot as any)
    ?.investoredge_components as ScoreComponentBreakdown[] | undefined;
  return components?.find((c) => c.component === componentName);
}

/**
 * AppreciationDeepDive - Component deep dive for the Appreciation score component.
 *
 * Displays the appreciation score badge, key metrics (home value YoY, 3-year
 * appreciation, 5-year appreciation, hotness score), historical home value trend,
 * AI narrative, projected dollar appreciation, and partner recommendations.
 */
export function AppreciationDeepDive({
  report,
}: AppreciationDeepDiveProps): React.ReactElement {
  const component = findComponent(report, 'appreciation');

  // -- Metrics --
  const homeValueYoY = getMetricValueWithAliases(
    report as any,
    'home_value_yoy',
    ['zhvi_yoy']
  );
  const threeYearChange = getMetricWithAliases(
    report as any,
    'zhvi_3y_change'
  );
  const fiveYearChange = getMetricWithAliases(
    report as any,
    'zhvi_5y_change'
  );
  const hotnessScore = getMetricWithAliases(report as any, 'hotness_score');

  // -- Benchmarks --
  const nationalBenchmarks = report.populated_data?.benchmarks?.national;
  const nationalHomeValueYoY =
    nationalBenchmarks?.home_value_yoy ??
    nationalBenchmarks?.zhvi_yoy ??
    null;

  // -- Build metric items --
  const metrics: MetricItem[] = [];

  metrics.push({
    label: 'Home Value YoY',
    value: homeValueYoY,
    format: 'percent',
    benchmark:
      nationalHomeValueYoY != null
        ? { label: 'National', value: nationalHomeValueYoY }
        : undefined,
  });

  metrics.push({
    label: '3-Year Appreciation',
    value: threeYearChange,
    format: 'percent',
  });

  metrics.push({
    label: '5-Year Appreciation',
    value: fiveYearChange,
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

  // -- AI Narrative --
  const narrative = report.ai_narrative?.appreciation_narrative;

  // -- Personalized --
  const investmentBudget = report.user_inputs?.investment_budget;
  const personalizedContent =
    report.ai_narrative?.appreciation_personalized ??
    (investmentBudget && homeValueYoY
      ? `Based on your investment budget of ${formatMetricValue(investmentBudget, 'currency')}, ` +
        `the current annual appreciation rate of ${formatMetricValue(homeValueYoY, 'percent')} ` +
        `could translate to approximately ${formatMetricValue(
          Math.round(investmentBudget * (homeValueYoY / 100)),
          'currency'
        )} in equity gain over the next year. ` +
        (fiveYearChange
          ? `Over five years, the local market has appreciated ${formatMetricValue(fiveYearChange, 'percent')}, ` +
            `which on a ${formatMetricValue(investmentBudget, 'currency')} property would equal roughly ` +
            `${formatMetricValue(
              Math.round(investmentBudget * (fiveYearChange / 100)),
              'currency'
            )} in total appreciation.`
          : 'Past performance does not guarantee future results, but this rate suggests solid growth potential.')
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
      <SectionCard title="Appreciation" icon={TrendingUp}>
        <div className="flex items-center justify-center py-12">
          <p
            className="text-sm"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Appreciation data is not yet available for this market.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Appreciation" icon={TrendingUp}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* Component Score Badge */}
        {score !== null && (
          <ComponentScoreBadge
            component="appreciation"
            score={score}
            label={`Appreciation: ${score}/100`}
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
                Home Value Trend
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
                    {formatMetricValue(
                      historicalRaw.data[0].value,
                      'currency'
                    )}
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
            title="Appreciation Analysis"
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
        <RecommendationSlot contextType="growth" report={report} />
      </div>
    </SectionCard>
  );
}

export default AppreciationDeepDive;
