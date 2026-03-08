/**
 * Narrative Insights Module
 *
 * Transforms raw metrics into pre-computed analytical strings ("so what"
 * context) before they reach the AI model. The model receives digested
 * analysis rather than raw numbers it would need to compute itself.
 *
 * Investment math lives in ./narrative-insights-investment.ts to keep
 * each file under the 300-line limit.
 */

import type { AnalyticalInsights } from './narrative-insights.types';
import { computeInvestmentMath } from './narrative-insights-investment';

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

function pctDiff(value: number, benchmark: number): number {
  return ((value - benchmark) / benchmark) * 100;
}

/** Standard monthly mortgage payment (principal + interest). */
export function calcMonthlyPayment(
  principal: number,
  annualRate: number,
  years: number,
): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  if (monthlyRate === 0) return principal / numPayments;
  return (
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );
}

// ── Affordability ────────────────────────────────────────────────────────

function computeAffordability(
  metrics: Record<string, any>,
  benchmarks: Record<string, any>,
  userInputs?: Record<string, any>,
): Partial<AnalyticalInsights> {
  const result: Partial<AnalyticalInsights> = {};

  const price = num(metrics.zhvi) ?? num(metrics.median_listing_price);
  const downPct = num(userInputs?.down_payment_pct) ?? 20;
  const rate = num(userInputs?.mortgage_rate) ?? 6.5;
  const income =
    num(metrics.median_household_income) ?? num(metrics.median_income);

  if (price) {
    const downPayment = price * (downPct / 100);
    const loanAmount = price - downPayment;
    const monthly = calcMonthlyPayment(loanAmount, rate / 100, 30);
    result.monthly_payment_estimate = `${fmtCurrency(monthly)}/mo at ${rate}% with ${downPct}% down`;

    if (income) {
      const annualPayment = monthly * 12;
      const dti = (annualPayment / income) * 100;
      const qualifier =
        dti < 28
          ? 'well within conventional limits'
          : dti < 36
            ? 'within conventional limits'
            : dti < 43
              ? 'at the edge of conventional limits'
              : 'exceeds conventional limits';
      result.dti_at_median_income = `${fmtPct(dti, 0)} DTI — ${qualifier}`;
    }
  }

  const nationalPrice = num(benchmarks?.national?.zhvi);
  const statePrice = num(benchmarks?.state?.zhvi);

  if (price && nationalPrice) {
    const diff = pctDiff(price, nationalPrice);
    const dir = diff >= 0 ? 'above' : 'below';
    result.price_vs_national_pct = `${fmtPct(Math.abs(diff), 0)} ${dir} national median`;
  }

  if (price && statePrice) {
    const diff = pctDiff(price, statePrice);
    const dir = diff >= 0 ? 'above' : 'below';
    result.price_vs_state_pct = `${fmtPct(Math.abs(diff), 0)} ${dir} state median`;
  }

  if (result.price_vs_state_pct && result.dti_at_median_income) {
    const dtiVal = num(result.dti_at_median_income);
    const stateDir = result.price_vs_state_pct.includes('below')
      ? 'affordable'
      : 'expensive';
    const incomeStrain =
      dtiVal && dtiVal > 36 ? 'stretching' : 'manageable for';
    result.affordability_verdict = `${stateDir === 'affordable' ? 'Affordable' : 'Expensive'} relative to state, ${incomeStrain} local incomes`;
  }

  return result;
}

// ── Market Position ──────────────────────────────────────────────────────

/**
 * Classify the simple market type: Buyer's, Seller's, or Balanced.
 * Based on months of supply thresholds used industry-wide.
 */
export function classifyMarketType(monthsOfSupply: number | null): string {
  if (monthsOfSupply === null) return 'Insufficient data';
  if (monthsOfSupply < 4) return "Seller's Market";
  if (monthsOfSupply <= 6) return 'Balanced Market';
  return "Buyer's Market";
}

export function classifyMarketPhase(
  monthsOfSupply: number | null,
  priceCutPct: number | null,
  zhviYoy: number | null,
): string {
  if (monthsOfSupply === null)
    return 'Insufficient data to classify market phase';

  const mos = monthsOfSupply;
  const yoy = zhviYoy ?? 0;
  const cuts = priceCutPct !== null ? priceCutPct * 100 : null;
  const marketType = classifyMarketType(mos);

  if (mos < 3 && yoy > 5)
    return `${marketType} (Peak Expansion) — strong demand, rapid price growth, limited buyer leverage`;
  if (mos < 4 && yoy > 0)
    return `${marketType} (Late Expansion) — prices still rising but momentum slowing, sellers retain advantage`;
  if (mos >= 4 && mos <= 6)
    return `${marketType} — supply and demand roughly in equilibrium, neither buyers nor sellers have clear advantage`;
  if (mos > 6 && (cuts === null || cuts > 20))
    return `${marketType} (Early Contraction) — inventory building, sellers adjusting prices, buyer leverage increasing`;
  if (mos > 6)
    return `${marketType} — elevated supply gives buyers negotiation leverage and time to be selective`;

  return `${marketType} (Transitional) — mixed signals across indicators`;
}

function computeMarketPosition(
  metrics: Record<string, any>,
): Partial<AnalyticalInsights> {
  const result: Partial<AnalyticalInsights> = {};

  const mos = num(metrics.months_of_supply);
  const priceCutPct =
    num(metrics.price_cut_pct) ?? num(metrics.price_reduced_share);
  const zhviYoy = num(metrics.zhvi_yoy);
  const saleToList = num(metrics.sale_to_list_ratio);
  const price = num(metrics.zhvi) ?? num(metrics.median_listing_price);

  result.market_phase = classifyMarketPhase(mos, priceCutPct, zhviYoy);
  result.market_type = classifyMarketType(mos);

  if (priceCutPct !== null) {
    const cutsPct = priceCutPct * 100;
    const leverage =
      cutsPct > 25
        ? 'Strong buyer leverage'
        : cutsPct > 15
          ? 'Slight buyer leverage'
          : 'Seller-favored market';
    result.buyer_leverage_assessment = `${leverage}: 1 in ${Math.round(100 / cutsPct)} sellers cutting prices`;
  }

  if (saleToList !== null && priceCutPct !== null) {
    const cutsPct = priceCutPct * 100;
    const startPct = Math.round(saleToList * 100) / 100;
    result.offer_strategy = `Start at ${fmtPct(startPct, 0)} of list; ${fmtPct(cutsPct, 0)} of listings see price cuts`;
  }

  if (price && zhviYoy !== null) {
    const monthlyAppreciation = (price * (zhviYoy / 100)) / 12;
    const direction =
      zhviYoy >= 0 ? 'appreciation if you wait' : 'savings if you wait';
    result.waiting_cost_per_month = `~${fmtCurrency(Math.abs(monthlyAppreciation))}/month in ${direction}`;
  }

  return result;
}

// ── Trend Narratives ─────────────────────────────────────────────────────

export function classifyTrajectory(
  yoy: number | null,
  cagr3y: number | null,
  cagr5y: number | null,
): string {
  if (yoy === null) return 'Insufficient data';
  const vals = [yoy, cagr3y, cagr5y].filter((v) => v !== null);
  if (vals.length < 2) return `${fmtPct(yoy)} 1Y`;

  const compareTo = cagr3y ?? cagr5y ?? yoy;
  const trend =
    yoy > compareTo + 1
      ? 'Accelerating'
      : yoy < compareTo - 1
        ? 'Decelerating'
        : 'Steady';

  const parts = [`${fmtPct(yoy)} 1Y`];
  if (cagr3y !== null) parts.push(`${fmtPct(cagr3y)} 3Y`);
  if (cagr5y !== null) parts.push(`${fmtPct(cagr5y)} 5Y`);
  return `${trend}: ${parts.join(' \u2192 ')}`;
}

function computeTrends(
  metrics: Record<string, any>,
): Partial<AnalyticalInsights> {
  return {
    appreciation_trajectory: classifyTrajectory(
      num(metrics.zhvi_yoy),
      num(metrics.zhvi_3y_cagr),
      num(metrics.zhvi_5y_cagr),
    ),
    rent_growth_trajectory: classifyTrajectory(
      num(metrics.zori_yoy),
      null,
      num(metrics.zori_5y_cagr),
    ),
  };
}

// ── Risk Quantification ──────────────────────────────────────────────────

function computeRisk(
  metrics: Record<string, any>,
  userInputs?: Record<string, any>,
): Partial<AnalyticalInsights> {
  const result: Partial<AnalyticalInsights> = {};
  const price = num(metrics.zhvi) ?? num(metrics.median_listing_price);
  const downPct = (num(userInputs?.down_payment_pct) ?? 20) / 100;
  const unemployment = num(metrics.unemployment_rate);

  if (unemployment !== null) {
    result.downside_scenario = `If unemployment rises 2pts to ${fmtPct(unemployment + 2, 1)}, expect 8-12% correction`;
  }

  if (price) {
    const downPayment = price * downPct;
    const loss = price * 0.1;
    const equityPct = (loss / downPayment) * 100;
    result.equity_at_risk = `At median price with ${downPct * 100}% down, 10% correction = ${fmtCurrency(loss)} loss (${fmtPct(equityPct, 0)} of equity)`;
  }

  return result;
}

// ── Public API ───────────────────────────────────────────────────────────

export function computeAnalyticalInsights(
  metrics: Record<string, any>,
  scores: any,
  benchmarks: Record<string, any>,
  userType: string,
  userInputs?: Record<string, any>,
): Partial<AnalyticalInsights> {
  return {
    ...computeAffordability(metrics, benchmarks, userInputs),
    ...computeMarketPosition(metrics),
    ...(userType === 'investor'
      ? computeInvestmentMath(metrics, userInputs)
      : {}),
    ...computeTrends(metrics),
    ...computeRisk(metrics, userInputs),
  };
}
