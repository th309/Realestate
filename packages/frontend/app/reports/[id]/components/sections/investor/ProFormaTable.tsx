import React from 'react';

import { formatMetricValue } from '@/lib/data';

// ---------------------------------------------------------------------------
// Pro forma calculation helpers
// ---------------------------------------------------------------------------

export interface SimplifiedProForma {
  purchasePrice: number;
  downPaymentPct: number;
  downPayment: number;
  loanAmount: number;
  interestRate: number;
  monthlyRent: number;
  monthlyPI: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPITI: number;
  monthlyCashFlow: number;
  annualRent: number;
  annualTaxInsurance: number;
  annualNOI: number;
  capRate: number;
  cashOnCash: number;
}

/**
 * Calculate a simplified pro forma from market data and user budget.
 *
 * Assumes: 20% down, 7% rate, 30yr term, 1.2% property tax, 0.5% insurance.
 */
export function calculateSimplifiedProForma(
  purchasePrice: number,
  monthlyRent: number
): SimplifiedProForma {
  const downPaymentPct = 0.2;
  const downPayment = purchasePrice * downPaymentPct;
  const loanAmount = purchasePrice * (1 - downPaymentPct);
  const interestRate = 0.07;
  const monthlyRate = interestRate / 12;
  const numPayments = 360; // 30 years

  // Monthly principal & interest
  const monthlyPI =
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  // Monthly tax & insurance
  const annualTax = purchasePrice * 0.012;
  const annualInsurance = purchasePrice * 0.005;
  const monthlyTax = annualTax / 12;
  const monthlyInsurance = annualInsurance / 12;

  const monthlyPITI = monthlyPI + monthlyTax + monthlyInsurance;
  const monthlyCashFlow = monthlyRent - monthlyPITI;

  const annualRent = monthlyRent * 12;
  const annualTaxInsurance = annualTax + annualInsurance;
  const annualNOI = annualRent - annualTaxInsurance;
  const capRate = purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCash = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;

  return {
    purchasePrice,
    downPaymentPct,
    downPayment,
    loanAmount,
    interestRate,
    monthlyRent,
    monthlyPI: Math.round(monthlyPI),
    monthlyTax: Math.round(monthlyTax),
    monthlyInsurance: Math.round(monthlyInsurance),
    monthlyPITI: Math.round(monthlyPITI),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    annualRent: Math.round(annualRent),
    annualTaxInsurance: Math.round(annualTaxInsurance),
    annualNOI: Math.round(annualNOI),
    capRate,
    cashOnCash,
  };
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

export interface FinancialCardProps {
  label: string;
  value: number;
  format: 'currency' | 'percent';
  highlight?: 'positive' | 'negative' | 'neutral';
}

export function FinancialCard({ label, value, format, highlight }: FinancialCardProps) {
  const displayValue =
    format === 'percent'
      ? `${value.toFixed(1)}%`
      : formatMetricValue(Math.round(value), 'currency');

  const valueColor =
    highlight === 'positive'
      ? 'var(--report-success)'
      : highlight === 'negative'
        ? 'var(--report-error)'
        : 'var(--report-navy)';

  return (
    <div
      className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
      style={{
        backgroundColor: 'white',
        border: '1px solid rgba(27, 46, 74, 0.08)',
      }}
    >
      <p
        className="text-xs mb-[var(--report-space-xs)]"
        style={{ color: 'var(--report-stone-light)', margin: 0 }}
      >
        {label}
      </p>
      <p
        className="text-lg font-semibold"
        style={{
          color: valueColor,
          fontFamily: 'var(--report-font-display)',
          margin: 0,
        }}
      >
        {displayValue}
      </p>
    </div>
  );
}
