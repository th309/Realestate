/**
 * Scenario Computation
 *
 * Pre-computes forward-looking scenario math (rate changes, price
 * corrections, appreciation, bull/base/bear cases) so the AI model
 * receives concrete numbers rather than needing to calculate them.
 *
 * All scenario outputs are human-readable strings ready for prompt
 * template injection via {{placeholder}} tokens.
 */

import { calcMonthlyPayment } from './narrative-insights';

// ── Helpers ──────────────────────────────────────────────────────────────

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

// ── Types ────────────────────────────────────────────────────────────────

export interface ScenarioInputs {
  // Rate scenarios
  rate_drop_monthly_payment: string;
  rate_hold_monthly_payment: string;
  rate_drop_buying_power_change: string;

  // Price correction scenarios
  correction_10pct_new_price: string;
  correction_10pct_equity_impact: string;
  appreciation_5pct_equity_gain: string;

  // Investment scenarios (bull/base/bear)
  bull_case_total_return: string;
  base_case_total_return: string;
  bear_case_total_return: string;
}

// ── Rate Scenarios ───────────────────────────────────────────────────────

function computeRateScenarios(
  price: number,
  currentRate: number,
  downPct: number,
): Partial<ScenarioInputs> {
  const result: Partial<ScenarioInputs> = {};
  const loanAmount = price * (1 - downPct / 100);

  const currentMonthly = calcMonthlyPayment(loanAmount, currentRate / 100, 30);
  const droppedRate = currentRate - 1;
  const droppedMonthly = calcMonthlyPayment(loanAmount, droppedRate / 100, 30);
  const delta = currentMonthly - droppedMonthly;

  result.rate_hold_monthly_payment = `At ${fmtPct(currentRate)}, payment stays at ${fmtCurrency(currentMonthly)}`;

  result.rate_drop_monthly_payment = `At ${fmtPct(droppedRate)}, payment drops to ${fmtCurrency(droppedMonthly)} (-${fmtCurrency(delta)}/mo)`;

  // Buying power: how much more home can they afford at the lower rate
  // keeping the same monthly payment
  const buyingPowerAtLowerRate = calculateMaxLoanForPayment(
    currentMonthly,
    droppedRate / 100,
    30,
  );
  const buyingPowerChange = buyingPowerAtLowerRate - loanAmount;

  result.rate_drop_buying_power_change = `You can afford ${fmtCurrency(buyingPowerChange)} more home at ${fmtPct(droppedRate)}`;

  return result;
}

/** Inverse of monthly payment formula: max loan for a given payment. */
function calculateMaxLoanForPayment(
  targetPayment: number,
  annualRate: number,
  years: number,
): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  if (monthlyRate === 0) return targetPayment * numPayments;
  return (
    (targetPayment * (Math.pow(1 + monthlyRate, numPayments) - 1)) /
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments))
  );
}

// ── Price Correction Scenarios ───────────────────────────────────────────

function computePriceCorrectionScenarios(
  price: number,
  downPct: number,
  zhviYoy: number | null,
): Partial<ScenarioInputs> {
  const result: Partial<ScenarioInputs> = {};
  const downPayment = price * (downPct / 100);

  // 10% correction
  const correctedPrice = price * 0.9;
  const equityLoss = price * 0.1;
  const equityLossPct = (equityLoss / downPayment) * 100;

  result.correction_10pct_new_price = `10% correction takes price from ${fmtCurrency(price)} to ${fmtCurrency(correctedPrice)}`;

  result.correction_10pct_equity_impact = `${fmtCurrency(equityLoss)} loss = ${fmtPct(equityLossPct, 0)} of your ${fmtCurrency(downPayment)} down payment`;

  // 5% continued appreciation
  const appreciationRate = zhviYoy !== null ? zhviYoy : 5;
  const appreciatedPrice = price * (1 + appreciationRate / 100);
  const equityGain = appreciatedPrice - price;

  result.appreciation_5pct_equity_gain = `At ${fmtPct(appreciationRate)} appreciation, year-1 equity gain = ${fmtCurrency(equityGain)} on top of ${fmtCurrency(downPayment)} down payment`;

  return result;
}

// ── Investment Return Scenarios ──────────────────────────────────────────

function computeInvestmentReturnScenarios(
  metrics: Record<string, any>,
): Partial<ScenarioInputs> {
  const result: Partial<ScenarioInputs> = {};

  const zhviYoy = num(metrics.zhvi_yoy);
  const jobGrowth = num(metrics.job_growth_yoy);
  const unemployment = num(metrics.unemployment_rate);
  const grossYield = num(metrics.gross_yield);

  if (grossYield === null && zhviYoy === null) return result;

  const baseAppreciation = zhviYoy ?? 3;
  const baseYield = grossYield ?? 5;

  // Bull case: job growth accelerates, appreciation up 2pts
  const bullAppreciation = baseAppreciation + 2;
  const bullYield = baseYield + 0.5;
  const bullTotal = bullAppreciation + bullYield;
  const bullDriver =
    jobGrowth !== null
      ? `job growth accelerates from ${fmtPct(jobGrowth)} to ${fmtPct(jobGrowth + 1)}`
      : 'economic tailwinds lift demand';
  result.bull_case_total_return = `Bull case: ${fmtPct(bullTotal)} total return if ${bullDriver}`;

  // Base case: current trajectory continues
  const baseTotal = baseAppreciation + baseYield;
  result.base_case_total_return = `Base case: ${fmtPct(baseTotal)} total return at current trajectory`;

  // Bear case: unemployment rises 1.5pts, appreciation drops
  const bearAppreciation = Math.min(baseAppreciation - 3, 0);
  const bearYield = baseYield - 0.3;
  const bearTotal = bearAppreciation + bearYield;
  const bearDriver =
    unemployment !== null
      ? `unemployment rises from ${fmtPct(unemployment)} to ${fmtPct(unemployment + 1.5)}`
      : 'economic headwinds reduce demand';
  result.bear_case_total_return = `Bear case: ${fmtPct(bearTotal)} total return if ${bearDriver}`;

  return result;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Compute all scenario analysis inputs from market metrics and user inputs.
 * Returns pre-formatted strings ready for prompt template injection.
 */
export function computeScenarioInputs(
  metrics: Record<string, any>,
  scores: any,
  userType: string,
  userInputs?: Record<string, any>,
): Partial<ScenarioInputs> {
  const price = num(metrics.zhvi) ?? num(metrics.median_listing_price);
  if (!price) return {};

  const downPct =
    num(userInputs?.down_payment_pct) ?? (userType === 'investor' ? 25 : 20);
  const rate = num(userInputs?.mortgage_rate) ?? 6.5;
  const zhviYoy = num(metrics.zhvi_yoy);

  return {
    ...computeRateScenarios(price, rate, downPct),
    ...computePriceCorrectionScenarios(price, downPct, zhviYoy),
    ...computeInvestmentReturnScenarios(metrics),
  };
}

// Export for testing
export { calculateMaxLoanForPayment };
