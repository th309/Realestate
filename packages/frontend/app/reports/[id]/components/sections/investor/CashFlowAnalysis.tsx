'use client';

import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

import { SectionCard, MetricDisplay, AIAnalysisBlock } from '../core';
import {
  getMetricValueWithAliases,
  getMetricTrend,
} from '../../utils/metricHelpers';
import type { MetricTrend } from '../../utils/metricHelpers';
import {
  CAP_RATE,
  GROSS_RENT_MULTIPLIER,
  GROSS_YIELD,
  CASH_ON_CASH,
  NORMALIZED_SCORE,
} from '../../utils/thresholds';
import type { ReportInstance } from '../../../../types';

/**
 * Props for CashFlowAnalysis section
 */
export interface CashFlowAnalysisProps {
  report: ReportInstance;
}

/**
 * Metric configuration for cash flow metrics
 */
interface CashFlowMetricConfig {
  id: string;
  aliases: string[];
  label: string;
  description: string;
  interpretation: {
    good: string;
    moderate: string;
    poor: string;
  };
}

/**
 * Cash flow metrics configuration
 */
const CASH_FLOW_METRICS: CashFlowMetricConfig[] = [
  {
    id: 'cap_rate',
    aliases: ['capitalization_rate', 'noi_yield'],
    label: 'Cap Rate',
    description: 'Primary yield metric - Net Operating Income as % of property value',
    interpretation: {
      good: 'Strong cash flow potential with healthy returns',
      moderate: 'Acceptable yield for the market conditions',
      poor: 'Lower than typical yields - may rely on appreciation',
    },
  },
  {
    id: 'gross_yield',
    aliases: ['gross_rental_yield', 'rental_yield'],
    label: 'Gross Yield',
    description: 'Gross rental income as % of property value (before expenses)',
    interpretation: {
      good: 'High gross income relative to property cost',
      moderate: 'Average gross income for the area',
      poor: 'Low rental income relative to purchase price',
    },
  },
  {
    id: 'grm',
    aliases: ['gross_rent_multiplier'],
    label: 'GRM',
    description: 'Gross Rent Multiplier - years of rent to equal purchase price',
    interpretation: {
      good: 'Lower GRM indicates faster payback potential',
      moderate: 'Typical GRM for this market',
      poor: 'Higher GRM means longer time to recoup investment',
    },
  },
  {
    id: 'rent_index',
    aliases: ['zori', 'median_rent', 'expected_rent'],
    label: 'Expected Rent',
    description: 'Typical monthly rental income for the area',
    interpretation: {
      good: 'Strong rental market with solid income potential',
      moderate: 'Average rental rates for the region',
      poor: 'Below-average rental rates may limit returns',
    },
  },
];

/**
 * Evaluate the quality of a cap rate
 */
function evaluateCapRate(capRate: number | null): 'good' | 'moderate' | 'poor' | null {
  if (capRate === null) return null;
  if (capRate >= CAP_RATE.GOOD) return 'good';
  if (capRate >= CAP_RATE.MODERATE) return 'moderate';
  return 'poor';
}

/**
 * Evaluate the quality of a GRM (lower is better for investors)
 */
function evaluateGRM(grm: number | null): 'good' | 'moderate' | 'poor' | null {
  if (grm === null) return null;
  if (grm <= GROSS_RENT_MULTIPLIER.EXCELLENT) return 'good';
  if (grm <= GROSS_RENT_MULTIPLIER.GOOD) return 'moderate';
  return 'poor';
}

/**
 * Calculate overall cash flow assessment
 */
function calculateCashFlowAssessment(
  capRate: number | null,
  grossYield: number | null,
  grm: number | null
): {
  rating: 'strong' | 'moderate' | 'weak' | 'unknown';
  summary: string;
} {
  let score = 0;
  let factors = 0;

  // Cap rate evaluation
  if (capRate !== null) {
    factors++;
    if (capRate >= CAP_RATE.GOOD) score += 2;
    else if (capRate >= CAP_RATE.MODERATE) score += 1;
    else if (capRate < CAP_RATE.WEAK) score -= 1;
  }

  // GRM evaluation (lower is better)
  if (grm !== null) {
    factors++;
    if (grm <= GROSS_RENT_MULTIPLIER.EXCELLENT) score += 2;
    else if (grm <= GROSS_RENT_MULTIPLIER.GOOD) score += 1;
    else if (grm > GROSS_RENT_MULTIPLIER.POOR) score -= 1;
  }

  // Gross yield evaluation
  if (grossYield !== null) {
    factors++;
    if (grossYield >= GROSS_YIELD.EXCELLENT) score += 2;
    else if (grossYield >= GROSS_YIELD.GOOD) score += 1;
    else if (grossYield < GROSS_YIELD.WEAK) score -= 1;
  }

  if (factors === 0) {
    return {
      rating: 'unknown',
      summary: 'Insufficient data to assess cash flow potential.',
    };
  }

  const normalizedScore = score / factors;

  if (normalizedScore >= NORMALIZED_SCORE.STRONG) {
    return {
      rating: 'strong',
      summary: 'This market shows strong cash flow potential with attractive yield metrics.',
    };
  }
  if (normalizedScore >= NORMALIZED_SCORE.MODERATE - NORMALIZED_SCORE.SLIGHT) {
    return {
      rating: 'moderate',
      summary: 'Cash flow metrics are moderate. Returns may depend on both income and appreciation.',
    };
  }
  return {
    rating: 'weak',
    summary: 'Cash flow metrics suggest lower yields. Investment thesis may rely more on appreciation.',
  };
}

/**
 * CashFlowAnalysis - Analyzes cash flow potential for investors
 *
 * Helps investors answer: What returns can I expect from rental income?
 *
 * Displays:
 * - Key yield metrics (cap rate, gross yield, GRM, expected rent)
 * - Pro forma data if available
 * - Historical trends for yield metrics
 * - AI analysis focused on cash flow implications
 */
export function CashFlowAnalysis({ report }: CashFlowAnalysisProps): React.ReactElement {
  // Extract metric values using shared helpers
  const capRate = getMetricValueWithAliases(
    report,
    CASH_FLOW_METRICS[0].id,
    CASH_FLOW_METRICS[0].aliases
  );
  const grossYield = getMetricValueWithAliases(
    report,
    CASH_FLOW_METRICS[1].id,
    CASH_FLOW_METRICS[1].aliases
  );
  const grm = getMetricValueWithAliases(
    report,
    CASH_FLOW_METRICS[2].id,
    CASH_FLOW_METRICS[2].aliases
  );
  const expectedRent = getMetricValueWithAliases(
    report,
    CASH_FLOW_METRICS[3].id,
    CASH_FLOW_METRICS[3].aliases
  );

  // Check if we have any data
  const hasAnyData =
    capRate !== null ||
    grossYield !== null ||
    grm !== null ||
    expectedRent !== null;

  // Get pro forma data
  const proForma = report.populated_data?.pro_forma;
  const hasProForma = proForma && proForma.assumptions && proForma.monthly_cash_flow;

  // Calculate cash flow assessment
  const assessment = calculateCashFlowAssessment(capRate, grossYield, grm);

  // Get AI analysis focused on cash flow/investment
  const aiAnalysis =
    report.ai_narrative?.investment_analysis ||
    report.ai_narratives?.cash_flow_analysis ||
    report.ai_narratives?.investment_analysis ||
    report.ai_narratives?.yield_analysis;

  // If no data available, show unavailable state
  if (!hasAnyData && !hasProForma) {
    return (
      <SectionCard title="Cash Flow Analysis" icon={DollarSign}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">Cash flow data is not available for this area.</span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Cash Flow Analysis" icon={DollarSign}>
      {/* Cash Flow Assessment Summary */}
      {hasAnyData && (
        <div
          className="report-card-subtle"
          style={{
            padding: 'var(--report-space-lg)',
            marginBottom: 'var(--report-space-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--report-space-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--report-space-md)' }}>
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: 'var(--report-radius-md)',
                backgroundColor:
                  assessment.rating === 'strong'
                    ? 'var(--report-success-bg)'
                    : assessment.rating === 'moderate'
                    ? 'rgba(196, 163, 90, 0.15)'
                    : assessment.rating === 'weak'
                    ? 'var(--report-warning-bg)'
                    : 'var(--report-cream)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {assessment.rating === 'strong' ? (
                <TrendingUp
                  className="w-6 h-6"
                  style={{ color: 'var(--report-success)' }}
                  aria-hidden="true"
                />
              ) : assessment.rating === 'weak' ? (
                <TrendingDown
                  className="w-6 h-6"
                  style={{ color: 'var(--report-warning)' }}
                  aria-hidden="true"
                />
              ) : (
                <DollarSign
                  className="w-6 h-6"
                  style={{
                    color:
                      assessment.rating === 'moderate'
                        ? 'var(--report-gold)'
                        : 'var(--report-stone)',
                  }}
                  aria-hidden="true"
                />
              )}
            </div>

            <div>
              <p
                className="report-label"
                style={{ marginBottom: 'var(--report-space-xs)' }}
              >
                Cash Flow Potential
              </p>
              <p
                className="report-heading-sm"
                style={{
                  color:
                    assessment.rating === 'strong'
                      ? 'var(--report-success)'
                      : assessment.rating === 'moderate'
                      ? 'var(--report-gold)'
                      : assessment.rating === 'weak'
                      ? 'var(--report-warning)'
                      : 'var(--report-navy)',
                  margin: 0,
                  textTransform: 'capitalize',
                }}
              >
                {assessment.rating} Cash Flow
              </p>
            </div>
          </div>

          <div
            style={{
              textAlign: 'right',
              maxWidth: '320px',
            }}
          >
            <p className="report-body-sm" style={{ margin: 0 }}>
              {assessment.summary}
            </p>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--report-space-md)',
          marginBottom: 'var(--report-space-lg)',
        }}
      >
        {/* Cap Rate */}
        <MetricDisplay
          metricId="cap_rate"
          value={capRate}
          label="Cap Rate"
          trend={getMetricTrend(report, CASH_FLOW_METRICS[0].id, CASH_FLOW_METRICS[0].aliases)}
        />

        {/* Gross Yield */}
        <MetricDisplay
          metricId="gross_yield"
          value={grossYield}
          label="Gross Yield"
          trend={getMetricTrend(report, CASH_FLOW_METRICS[1].id, CASH_FLOW_METRICS[1].aliases)}
        />

        {/* GRM */}
        <MetricDisplay
          metricId="grm"
          value={grm}
          label="Gross Rent Multiplier"
          trend={getMetricTrend(report, CASH_FLOW_METRICS[2].id, CASH_FLOW_METRICS[2].aliases)}
        />

        {/* Expected Rent */}
        <MetricDisplay
          metricId="rent_index"
          value={expectedRent}
          label="Expected Rent"
          trend={getMetricTrend(report, CASH_FLOW_METRICS[3].id, CASH_FLOW_METRICS[3].aliases)}
        />
      </div>

      {/* Pro Forma Summary (if available) */}
      {hasProForma && proForma && (
        <div
          className="report-card-subtle"
          style={{
            padding: 'var(--report-space-lg)',
            marginBottom: 'var(--report-space-lg)',
          }}
        >
          <p
            className="report-label"
            style={{ marginBottom: 'var(--report-space-md)' }}
          >
            Pro Forma Projection
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--report-space-md)',
            }}
          >
            {/* Monthly Cash Flow */}
            <div>
              <p className="report-body-sm" style={{ marginBottom: 'var(--report-space-xs)' }}>
                Monthly Net Cash Flow
              </p>
              <p
                className="report-heading-sm"
                style={{
                  color:
                    proForma.monthly_cash_flow.net_cash_flow >= 0
                      ? 'var(--report-success)'
                      : 'var(--report-error)',
                  margin: 0,
                }}
              >
                ${Math.abs(proForma.monthly_cash_flow.net_cash_flow).toLocaleString()}
                {proForma.monthly_cash_flow.net_cash_flow < 0 && (
                  <span style={{ fontSize: '0.75em' }}> (negative)</span>
                )}
              </p>
            </div>

            {/* NOI */}
            <div>
              <p className="report-body-sm" style={{ marginBottom: 'var(--report-space-xs)' }}>
                Monthly NOI
              </p>
              <p className="report-heading-sm" style={{ margin: 0 }}>
                ${proForma.monthly_cash_flow.net_operating_income.toLocaleString()}
              </p>
            </div>

            {/* Cash on Cash Return */}
            {proForma.returns && (
              <div>
                <p className="report-body-sm" style={{ marginBottom: 'var(--report-space-xs)' }}>
                  Cash-on-Cash Return
                </p>
                <p
                  className="report-heading-sm"
                  style={{
                    color:
                      proForma.returns.cash_on_cash >= CASH_ON_CASH.EXCELLENT
                        ? 'var(--report-success)'
                        : proForma.returns.cash_on_cash >= CASH_ON_CASH.GOOD
                        ? 'var(--report-gold)'
                        : 'var(--report-warning)',
                    margin: 0,
                  }}
                >
                  {proForma.returns.cash_on_cash.toFixed(1)}%
                </p>
              </div>
            )}

            {/* Pro Forma Cap Rate */}
            {proForma.returns && (
              <div>
                <p className="report-body-sm" style={{ marginBottom: 'var(--report-space-xs)' }}>
                  Pro Forma Cap Rate
                </p>
                <p className="report-heading-sm" style={{ margin: 0 }}>
                  {proForma.returns.cap_rate.toFixed(1)}%
                </p>
              </div>
            )}
          </div>

          {/* Assumptions Note */}
          {proForma.assumptions && (
            <p
              className="report-body-sm"
              style={{
                marginTop: 'var(--report-space-md)',
                paddingTop: 'var(--report-space-md)',
                borderTop: '1px solid rgba(27, 46, 74, 0.06)',
                fontStyle: 'italic',
              }}
            >
              Based on {proForma.assumptions.down_payment_pct}% down payment at{' '}
              {proForma.assumptions.interest_rate}% interest rate,{' '}
              {proForma.assumptions.vacancy_pct}% vacancy allowance
            </p>
          )}
        </div>
      )}

      {/* Metric Interpretations */}
      {hasAnyData && (
        <div
          className="report-card-subtle"
          style={{
            padding: 'var(--report-space-md)',
            marginBottom: 'var(--report-space-lg)',
          }}
        >
          <p
            className="report-label"
            style={{ marginBottom: 'var(--report-space-sm)' }}
          >
            Understanding These Metrics
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 'var(--report-space-sm)',
            }}
          >
            {CASH_FLOW_METRICS.map((metric) => {
              const value = getMetricValueWithAliases(report, metric.id, metric.aliases);
              if (value === null) return null;

              // Determine quality for this metric
              let quality: 'good' | 'moderate' | 'poor' = 'moderate';
              if (metric.id === 'cap_rate') {
                quality = evaluateCapRate(value) || 'moderate';
              } else if (metric.id === 'grm') {
                quality = evaluateGRM(value) || 'moderate';
              }

              return (
                <div
                  key={metric.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--report-space-sm)',
                  }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      marginTop: '6px',
                      flexShrink: 0,
                      backgroundColor:
                        quality === 'good'
                          ? 'var(--report-success)'
                          : quality === 'moderate'
                          ? 'var(--report-gold)'
                          : 'var(--report-warning)',
                    }}
                  />
                  <p className="report-body-sm" style={{ margin: 0 }}>
                    <strong>{metric.label}:</strong> {metric.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {aiAnalysis && (
        <AIAnalysisBlock
          content={typeof aiAnalysis === 'string' ? aiAnalysis : String(aiAnalysis)}
          title="Cash Flow Insights"
          variant="insight"
        />
      )}
    </SectionCard>
  );
}

export default CashFlowAnalysis;
