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
import type { ReportInstance } from '../../../../types';

export interface EntryPointDeepDiveProps {
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
 * EntryPointDeepDive - Component deep dive for the Entry Point score component.
 *
 * Displays the entry point score badge, key metrics (median price, price per sqft,
 * price reduced share, active listings), historical price trend, AI narrative,
 * personalized buying power insight, and partner recommendations.
 */
export function EntryPointDeepDive({
  report,
}: EntryPointDeepDiveProps): React.ReactElement {
  const component = findComponent(report, 'entry_point');

  // -- Metrics --
  const medianPrice = getMetricValueWithAliases(report as any, 'median_listing_price', [
    'zhvi',
    'home_value',
  ]);
  const pricePerSqft = getMetricWithAliases(report as any, 'price_per_sqft');
  const priceReducedShare = getMetricValueWithAliases(report as any, 'price_reduced_share', [
    'price_cut_pct',
  ]);
  const activeListingCount = getMetricValueWithAliases(report as any, 'active_listing_count', [
    'for_sale_inventory',
  ]);

  // -- Benchmarks --
  const nationalBenchmarks = report.populated_data?.benchmarks?.national;
  const nationalPrice =
    nationalBenchmarks?.median_listing_price ??
    nationalBenchmarks?.zhvi ??
    nationalBenchmarks?.home_value ??
    null;

  // -- Build metric items --
  const metrics: MetricItem[] = [];

  metrics.push({
    label: 'Median Home Price',
    value: medianPrice,
    format: 'currency',
    benchmark: nationalPrice != null ? { label: 'National', value: nationalPrice } : undefined,
  });

  metrics.push({
    label: 'Price per Sqft',
    value: pricePerSqft,
    format: 'currency',
  });

  metrics.push({
    label: 'Price Reduced Share',
    value: priceReducedShare,
    format: 'percent',
  });

  metrics.push({
    label: 'Active Listing Count',
    value: activeListingCount,
    format: 'number',
  });

  // -- Trend data --
  const historicalRaw =
    report.populated_data?.historical?.zhvi ??
    report.populated_data?.historical?.home_value;

  // -- AI Narrative --
  const narrative = report.ai_narrative?.entry_point_narrative;

  // -- Personalized --
  const investmentBudget = report.user_inputs?.investment_budget;
  const downPayment = report.user_inputs?.down_payment;
  const personalizedContent =
    report.ai_narrative?.entry_point_personalized ??
    (investmentBudget && medianPrice
      ? `With your investment budget of ${formatMetricValue(investmentBudget, 'currency')}, ` +
        (investmentBudget >= medianPrice
          ? `you can comfortably acquire a median-priced property in this market. ` +
            `Your budget exceeds the median price by ${formatMetricValue(investmentBudget - medianPrice, 'currency')}, ` +
            `leaving room for closing costs and initial improvements.`
          : `the median home price of ${formatMetricValue(medianPrice, 'currency')} exceeds your budget. ` +
            `Consider targeting below-median properties or negotiating aggressively in a market where ` +
            `${priceReducedShare ? formatMetricValue(priceReducedShare, 'percent') + ' of listings have price reductions.' : 'price reductions may be available.'}`)
      : downPayment && medianPrice
        ? `With your down payment of ${formatMetricValue(downPayment, 'currency')}, ` +
          `that represents ${((downPayment / medianPrice) * 100).toFixed(1)}% of the median home price. ` +
          (downPayment / medianPrice >= 0.2
            ? `This puts you above the 20% threshold, avoiding PMI and strengthening your offer.`
            : `You may want to consider properties below the median to reach a 20% down payment ratio.`)
        : undefined);

  const personalizedInputs: string[] = [];
  if (report.user_inputs?.investment_budget) personalizedInputs.push('investment_budget');
  if (report.user_inputs?.down_payment) personalizedInputs.push('down_payment');

  // -- Score badge --
  const score = component?.score ?? null;
  const status: ComponentStatus = component?.status ?? 'moderate';

  const hasAnyData =
    score !== null || metrics.some((m) => m.value !== null) || narrative;

  if (!hasAnyData) {
    return (
      <SectionCard title="Entry Point" icon={DollarSign}>
        <div className="flex items-center justify-center py-12">
          <p
            className="text-sm"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Entry point data is not yet available for this market.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Entry Point" icon={DollarSign}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* Component Score Badge */}
        {score !== null && (
          <ComponentScoreBadge
            component="entry_point"
            score={score}
            label={`Entry Point: ${score}/100`}
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
                Price Trends
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
            title="Entry Point Analysis"
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
        <RecommendationSlot contextType="entry_point" report={report} />
      </div>
    </SectionCard>
  );
}

export default EntryPointDeepDive;
