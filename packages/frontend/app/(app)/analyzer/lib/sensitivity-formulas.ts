import type { DealInput, RentalResult } from "@propertyiq/analyzer-core";
import type {
  ImpactInputs,
  MetricKey,
  SensitivityVariable,
} from "./sensitivity-impacts";

/**
 * Internal first-order impact formulas. Each function computes the dollar (or
 * percent/ratio) change in a primary metric for one variable's standard move.
 * Public API in `sensitivity-impacts.ts` consumes these via `computeImpactForMetric`.
 */

interface CommonDerived {
  price: number;
  rent: number;
  tax: number;
  ins: number;
  vacancyPct: number;
  mgmtPct: number;
  maintPct: number;
  loan: number;
  cashIn: number;
  debtServiceAnnual: number;
  totalFlipCost: number;
}

function deriveCommon(opts: ImpactInputs): CommonDerived {
  const { input, rental, rehabBudget = 45_000 } = opts;
  const i = input as DealInput;
  const r = rental as RentalResult;
  const price = i.price ?? 0;
  const rent = i.rentMonthly ?? 0;
  const tax = i.taxAnnual ?? 0;
  const ins = i.insuranceAnnual ?? 0;
  const downPct = i.financing?.downPaymentPct ?? 0.2;
  const vacancyPct = i.vacancyPctOfRent ?? 0.05;
  const mgmtPct = i.managementPctOfRent ?? 0.08;
  const maintPct = i.maintenancePctOfRent ?? 0.08;
  const closingPct = i.financing?.closingCostsPct ?? 0.03;
  const loan = price * (1 - downPct);
  const cashIn =
    price * downPct +
    price * closingPct +
    (opts.strategy === "brrrr" ? rehabBudget : 0);
  const debtServiceAnnual = (r.monthlyDebtService ?? 0) * 12;
  const totalFlipCost = price + rehabBudget + price * closingPct;
  return {
    price,
    rent,
    tax,
    ins,
    vacancyPct,
    mgmtPct,
    maintPct,
    loan,
    cashIn,
    debtServiceAnnual,
    totalFlipCost,
  };
}

function noiImpactMonthly(v: SensitivityVariable, c: CommonDerived): number {
  switch (v) {
    case "rate":
      return 0;
    case "rent":
      return c.rent * 0.05 * (1 - c.vacancyPct - c.mgmtPct - c.maintPct);
    case "vacancy":
      return c.rent * 0.03;
    case "taxes":
      return (c.tax * 0.1) / 12;
    case "insurance":
      return (c.ins * 0.2) / 12;
    case "exitCap":
      return 0;
  }
}

function debtServiceImpactMonthly(
  v: SensitivityVariable,
  c: CommonDerived,
): number {
  if (v === "rate") return (c.loan * 0.01) / 12;
  return 0;
}

function cashflowImpactMonthly(
  v: SensitivityVariable,
  c: CommonDerived,
): number {
  return noiImpactMonthly(v, c) - debtServiceImpactMonthly(v, c);
}

function profitImpact(v: SensitivityVariable, c: CommonDerived): number {
  const holdYears = 0.5;
  switch (v) {
    case "rate":
      return c.loan * 0.01 * holdYears;
    case "rent":
    case "vacancy":
      return 0;
    case "taxes":
      return c.tax * 0.1 * holdYears;
    case "insurance":
      return c.ins * 0.2 * holdYears;
    case "exitCap":
      return 0;
  }
}

function capitalLeftImpact(
  v: SensitivityVariable,
  c: CommonDerived,
  arv: number,
): number {
  switch (v) {
    case "rate":
      return arv * 0.05;
    case "rent":
      return c.rent * 12 * 0.5;
    case "vacancy":
      return c.rent * 12 * 0.3;
    case "taxes":
      return c.tax * 0.5;
    case "insurance":
      return c.ins * 0.3;
    case "exitCap":
      return arv * 0.05;
  }
}

/**
 * Dispatcher: given a variable and the selected metric, return the metric's
 * change for that variable's standard move. Returns signed values where the
 * direction is meaningful; callers may take Math.abs for tornado magnitudes.
 */
export function computeImpactForMetric(
  v: SensitivityVariable,
  opts: ImpactInputs,
): number {
  const c = deriveCommon(opts);
  const metric: MetricKey = opts.metric;
  switch (metric) {
    case "monthlyCashflow":
      return cashflowImpactMonthly(v, c);
    case "coc":
      return c.cashIn > 0
        ? ((cashflowImpactMonthly(v, c) * 12) / c.cashIn) * 100
        : 0;
    case "cap":
      return c.price > 0 ? ((noiImpactMonthly(v, c) * 12) / c.price) * 100 : 0;
    case "dscr":
      return c.debtServiceAnnual > 0
        ? (noiImpactMonthly(v, c) * 12) / c.debtServiceAnnual
        : 0;
    case "noi":
      return noiImpactMonthly(v, c) * 12;
    case "netProfit":
      return profitImpact(v, c);
    case "roi":
      return c.totalFlipCost > 0
        ? (profitImpact(v, c) / c.totalFlipCost) * 100
        : 0;
    case "annualizedRoi":
      return c.totalFlipCost > 0
        ? ((profitImpact(v, c) / c.totalFlipCost) * 100) / 0.5
        : 0;
    case "mao":
      return v === "exitCap" ? opts.arv * 0.005 * 0.7 : 0;
    case "capitalLeft":
      return capitalLeftImpact(v, c, opts.arv);
    case "cashRecovery":
      return c.cashIn > 0
        ? (capitalLeftImpact(v, c, opts.arv) / c.cashIn) * 100
        : 0;
    case "postRefiCashflow":
      return cashflowImpactMonthly(v, c);
    case "cocOnRemaining": {
      const cap = capitalLeftImpact(v, c, opts.arv);
      return cap > 0 ? ((cashflowImpactMonthly(v, c) * 12) / cap) * 100 : 0;
    }
  }
}
