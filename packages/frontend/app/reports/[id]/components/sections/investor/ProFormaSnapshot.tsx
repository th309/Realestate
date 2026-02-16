'use client';

import React from 'react';
import { Calculator } from 'lucide-react';

import { formatMetricValue } from '@/lib/data';
import {
  SectionCard,
  AIAnalysisBlock,
  PersonalizedInsight,
  RecommendationSlot,
} from '../core';
import {
  getMetricValueWithAliases,
} from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';
import { calculateSimplifiedProForma, FinancialCard } from './ProFormaTable';

export interface ProFormaSnapshotProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ProFormaSnapshot - Conditional section that shows a simplified pro forma analysis.
 *
 * Only renders when the user has provided an investment budget or when
 * `report.populated_data?.pro_forma` exists. If pro_forma data exists, it is
 * displayed directly. If only a budget exists, a simplified pro forma is
 * calculated from market medians.
 */
export function ProFormaSnapshot({
  report,
  className = '',
}: ProFormaSnapshotProps): React.ReactElement | null {
  const existingProForma = report.populated_data?.pro_forma;
  const investmentBudget = report.user_inputs?.investment_budget;

  // ---- Gate: only render when we have budget or pro_forma ----
  if (!investmentBudget && !existingProForma) {
    return null;
  }

  // ---- If existing pro_forma data, display directly ----
  if (existingProForma) {
    const pf = existingProForma;
    const narrative = report.ai_narrative?.pro_forma_narrative;

    return (
      <SectionCard title="Pro Forma Snapshot" icon={Calculator} className={className}>
        {/* Key financial figures in a 2x3 grid */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-[var(--report-space-md)] mb-[var(--report-space-lg)]"
        >
          <FinancialCard
            label="Monthly Rent"
            value={pf.monthly_cash_flow.gross_rent}
            format="currency"
          />
          <FinancialCard
            label="Monthly PITI"
            value={
              pf.monthly_cash_flow.mortgage_pi +
              pf.monthly_cash_flow.property_tax +
              pf.monthly_cash_flow.insurance
            }
            format="currency"
          />
          <FinancialCard
            label="Monthly Cash Flow"
            value={pf.monthly_cash_flow.net_cash_flow}
            format="currency"
            highlight={pf.monthly_cash_flow.net_cash_flow >= 0 ? 'positive' : 'negative'}
          />
          <FinancialCard
            label="Annual NOI"
            value={pf.monthly_cash_flow.net_operating_income * 12}
            format="currency"
          />
          <FinancialCard
            label="Cap Rate"
            value={pf.returns.cap_rate}
            format="percent"
          />
          <FinancialCard
            label="Cash-on-Cash"
            value={pf.returns.cash_on_cash}
            format="percent"
            highlight={pf.returns.cash_on_cash >= 8 ? 'positive' : pf.returns.cash_on_cash >= 4 ? 'neutral' : 'negative'}
          />
        </div>

        {/* Assumptions disclosure */}
        {pf.assumptions && (
          <div
            className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)] mb-[var(--report-space-lg)]"
            style={{
              backgroundColor: 'var(--report-cream)',
              border: '1px solid rgba(27, 46, 74, 0.06)',
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-[var(--report-space-xs)]"
              style={{ color: 'var(--report-stone-light)' }}
            >
              Assumptions
            </p>
            <p className="text-sm" style={{ color: 'var(--report-stone)', margin: 0 }}>
              {pf.assumptions.down_payment_pct}% down payment &middot;{' '}
              {pf.assumptions.interest_rate}% interest rate &middot;{' '}
              {pf.assumptions.loan_term_years}yr term &middot;{' '}
              {pf.assumptions.vacancy_pct}% vacancy allowance
            </p>
          </div>
        )}

        {/* AI Narrative */}
        {narrative && (
          <div className="mb-[var(--report-space-lg)]">
            <AIAnalysisBlock
              content={narrative}
              title="Pro Forma Analysis"
              variant="insight"
            />
          </div>
        )}

        {/* Personalized Insight */}
        {investmentBudget && (
          <div className="mb-[var(--report-space-lg)]">
            <PersonalizedInsight
              content={`This pro forma is based on your investment budget of ${formatMetricValue(investmentBudget, 'currency')}. Actual returns will vary based on property condition, financing terms, and local market dynamics.`}
              inputsUsed={['investment_budget']}
            />
          </div>
        )}

        {/* Recommendation */}
        <RecommendationSlot contextType="pro_forma" report={report} />
      </SectionCard>
    );
  }

  // ---- Simplified pro forma from budget + market medians ----
  const medianPrice = getMetricValueWithAliases(report as any, 'median_listing_price', [
    'zhvi',
    'home_value',
  ]);
  const monthlyRent = getMetricValueWithAliases(report as any, 'zori', [
    'median_gross_rent',
    'rent_index',
    'median_rent',
    'expected_rent',
  ]);

  // Need at least a price and rent to compute anything meaningful
  const purchasePrice = investmentBudget ?? medianPrice;
  if (!purchasePrice || !monthlyRent) {
    return null;
  }

  const pf = calculateSimplifiedProForma(purchasePrice, monthlyRent);
  const narrative = report.ai_narrative?.pro_forma_narrative;

  return (
    <SectionCard title="Pro Forma Snapshot" icon={Calculator} className={className}>
      {/* Key financial figures in a 2x3 grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 gap-[var(--report-space-md)] mb-[var(--report-space-lg)]"
      >
        <FinancialCard
          label="Monthly Rent"
          value={pf.monthlyRent}
          format="currency"
        />
        <FinancialCard
          label="Monthly PITI"
          value={pf.monthlyPITI}
          format="currency"
        />
        <FinancialCard
          label="Monthly Cash Flow"
          value={pf.monthlyCashFlow}
          format="currency"
          highlight={pf.monthlyCashFlow >= 0 ? 'positive' : 'negative'}
        />
        <FinancialCard
          label="Annual NOI"
          value={pf.annualNOI}
          format="currency"
        />
        <FinancialCard
          label="Cap Rate"
          value={pf.capRate}
          format="percent"
        />
        <FinancialCard
          label="Cash-on-Cash"
          value={pf.cashOnCash}
          format="percent"
          highlight={pf.cashOnCash >= 8 ? 'positive' : pf.cashOnCash >= 4 ? 'neutral' : 'negative'}
        />
      </div>

      {/* Assumptions disclosure */}
      <div
        className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)] mb-[var(--report-space-lg)]"
        style={{
          backgroundColor: 'var(--report-cream)',
          border: '1px solid rgba(27, 46, 74, 0.06)',
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wide mb-[var(--report-space-xs)]"
          style={{ color: 'var(--report-stone-light)' }}
        >
          Assumptions
        </p>
        <p className="text-sm" style={{ color: 'var(--report-stone)', margin: 0 }}>
          {(pf.downPaymentPct * 100).toFixed(0)}% down payment &middot;{' '}
          {(pf.interestRate * 100).toFixed(0)}% interest rate &middot;{' '}
          30yr term &middot;{' '}
          1.2% property tax &middot;{' '}
          0.5% insurance
        </p>
      </div>

      {/* AI Narrative */}
      {narrative && (
        <div className="mb-[var(--report-space-lg)]">
          <AIAnalysisBlock
            content={narrative}
            title="Pro Forma Analysis"
            variant="insight"
          />
        </div>
      )}

      {/* Personalized Insight */}
      <div className="mb-[var(--report-space-lg)]">
        <PersonalizedInsight
          content={
            `Estimated using ${investmentBudget ? `your investment budget of ${formatMetricValue(investmentBudget, 'currency')}` : `the median home price of ${formatMetricValue(purchasePrice, 'currency')}`} ` +
            `and local median rent of ${formatMetricValue(monthlyRent, 'currency')}/mo. ` +
            `This simplified projection assumes standard financing terms. Actual returns will vary.`
          }
          inputsUsed={investmentBudget ? ['investment_budget'] : []}
        />
      </div>

      {/* Recommendation */}
      <RecommendationSlot contextType="pro_forma" report={report} />
    </SectionCard>
  );
}

export default ProFormaSnapshot;
