/**
 * Narrative Insights — Investment Math
 *
 * Pre-computed investment analysis strings: net yield, cash-on-cash,
 * monthly cash flow, total return, and break-even occupancy.
 * Split from narrative-insights.ts to stay under the 300-line limit.
 */

import type { AnalyticalInsights } from './narrative-insights.types';
import { DEFAULT_EXPENSE_ASSUMPTIONS } from './narrative-insights.types';
import { calcMonthlyPayment } from './narrative-insights';

function num(v: any): number | null {
  if (v === undefined || v === null || v === 'N/A') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function fmtCurrency(v: number): string {
  return '$' + Math.round(v).toLocaleString();
}

function fmtPct(v: number, decimals = 1): string {
  return v.toFixed(decimals) + '%';
}

/**
 * Calculate NOI from gross rent and property price using standard
 * expense assumptions (vacancy, maintenance, management, insurance, tax).
 */
export function calculateNoi(annualGrossRent: number, price: number): number {
  const exp = DEFAULT_EXPENSE_ASSUMPTIONS;
  return (
    annualGrossRent * (1 - exp.vacancyRate) -
    annualGrossRent * exp.maintenanceRate -
    annualGrossRent * exp.managementRate -
    exp.insuranceAnnual -
    price * exp.taxRate
  );
}

export function computeInvestmentMath(
  metrics: Record<string, any>,
  userInputs?: Record<string, any>,
): Partial<AnalyticalInsights> {
  const result: Partial<AnalyticalInsights> = {};
  const exp = DEFAULT_EXPENSE_ASSUMPTIONS;

  const price = num(metrics.zhvi) ?? num(metrics.median_listing_price);
  const rent = num(metrics.zori);
  const zhviYoy = num(metrics.zhvi_yoy);
  const downPct = (num(userInputs?.down_payment_pct) ?? 25) / 100;
  const rate = (num(userInputs?.mortgage_rate) ?? 6.5) / 100;

  if (!price || !rent) return result;

  const annualGrossRent = rent * 12;
  const noi = calculateNoi(annualGrossRent, price);
  const netYield = (noi / price) * 100;

  result.net_yield_estimate =
    `~${fmtPct(netYield)} net yield after vacancy (${exp.vacancyRate * 100}%), ` +
    `maintenance (${exp.maintenanceRate * 100}%), mgmt (${exp.managementRate * 100}%)`;

  const downPayment = price * downPct;
  const loanAmount = price - downPayment;
  const annualDebtService = calcMonthlyPayment(loanAmount, rate, 30) * 12;
  const cashFlow = noi - annualDebtService;
  const cashOnCash = (cashFlow / downPayment) * 100;

  result.cash_on_cash_estimate = `~${fmtPct(cashOnCash)} CoC return with ${downPct * 100}% down`;
  result.monthly_cash_flow_estimate = `~${fmtCurrency(cashFlow / 12)}/mo net cash flow per unit`;

  if (zhviYoy !== null) {
    const totalReturn = netYield + zhviYoy;
    result.total_return_estimate = `~${fmtPct(totalReturn)} total return (yield + appreciation)`;
  }

  // Break-even occupancy: what occupancy rate covers debt + expenses
  const expensesExVacancy =
    annualGrossRent * (exp.maintenanceRate + exp.managementRate) +
    exp.insuranceAnnual +
    price * exp.taxRate;
  const breakEvenOcc =
    (annualDebtService + expensesExVacancy) / annualGrossRent;
  result.break_even_occupancy = `${fmtPct(breakEvenOcc * 100, 0)} occupancy to break even`;

  return result;
}
