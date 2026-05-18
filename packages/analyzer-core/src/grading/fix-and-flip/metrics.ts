/**
 * Fix & Flip grading metrics. Layered on top of the lean `computeFlipMetrics`
 * from `../../flip.ts`: that module gives us `mao70`, `wholetailMax`, and a
 * sale-side `projectedProfit`. The grading rubric needs a richer cost model
 * (hold-period carrying costs, financing costs, contingency-adjusted rehab)
 * so we derive those here.
 *
 * Every helper takes a `FixAndFlipInput` and returns a plain number. All
 * defaults applied in one place so the grade orchestrator can stay terse.
 */
import {
  monthlyHoldingCosts as shMonthlyHoldingCosts,
  monthlyLoanInterest as shMonthlyLoanInterest,
} from "../shared/calculations";
import type { FixAndFlipInput, FlipFinancingType } from "./types";

const DEFAULTS = {
  buyClosingPct: 0.02,
  rehabContingencyPct: 0.1,
  sellingCostsPct: 0.07,
  holdMonths: 4,
  marketAvgRatePct: 7,
};

// ---- Small accessors / unit converters -------------------------------------

export function effectiveHoldMonths(input: FixAndFlipInput): number {
  return input.holdMonths ?? input.holdingMonths ?? DEFAULTS.holdMonths;
}

export function effectiveContingencyPct(input: FixAndFlipInput): number {
  return input.rehabContingencyPct ?? DEFAULTS.rehabContingencyPct;
}

export function effectiveSellingCostsPct(input: FixAndFlipInput): number {
  return input.sellingCostsPct ?? DEFAULTS.sellingCostsPct;
}

export function effectiveBuyClosingPct(input: FixAndFlipInput): number {
  return input.buyClosingPct ?? DEFAULTS.buyClosingPct;
}

export function effectiveFinancingType(
  input: FixAndFlipInput,
): FlipFinancingType {
  return input.financingType ?? "cash";
}

// ---- Cost components -------------------------------------------------------

/**
 * (ARV - rehab × (1 + contingency) - purchase) / ARV.
 *
 * Margin against the maxAcquisitionMultiplier rule. The canonical "70% rule"
 * says price + rehab ≤ 70% of ARV; this metric expresses how far below that
 * line you actually bought (positive = headroom, negative = overpaid).
 *
 * Note: the maxAcquisitionMultiplier from context is NOT applied here — this
 * raw margin is what the rubric grades. The context's max multiplier only
 * affects user-facing copy (you bought below your own line, etc.).
 */
export function purchaseMargin(input: FixAndFlipInput): number {
  if (input.arv <= 0) return 0;
  const rehabAdj = input.rehabBudget * (1 + effectiveContingencyPct(input));
  return (input.arv - rehabAdj - input.price) / input.arv;
}

/**
 * Monthly loan interest for the flip. Honors the `input.monthlyLoanInterest`
 * override (some operators have the figure pre-computed elsewhere) and
 * returns 0 for cash deals. Delegates the actual interest math to the
 * shared primitive so the formula stays in one place.
 */
export function monthlyLoanInterest(input: FixAndFlipInput): number {
  if (input.monthlyLoanInterest != null) return input.monthlyLoanInterest;
  if (effectiveFinancingType(input) === "cash") return 0;
  return shMonthlyLoanInterest(
    input.loanAmount ?? 0,
    input.interestRatePct ?? 0,
  );
}

/**
 * Per-month carrying cost during the hold (taxes, insurance, utilities,
 * HOA, plus loan interest). When `monthlyHoldingCosts` is set directly on
 * the input, it wins — escape hatch for users who already have a number
 * from elsewhere. Otherwise delegates to the shared primitive.
 */
export function monthlyHoldingCosts(input: FixAndFlipInput): number {
  if (input.monthlyHoldingCosts != null) return input.monthlyHoldingCosts;
  return shMonthlyHoldingCosts({
    propertyTaxAnnual: input.propertyTaxAnnual ?? 0,
    insuranceAnnual: input.insuranceAnnual ?? 0,
    utilitiesMonthly: input.utilitiesMonthly ?? 0,
    hoaMonthly: input.hoaMonthly ?? 0,
    monthlyLoanInterest: monthlyLoanInterest(input),
  });
}

/**
 * Total financing-side cost over the full hold. Cash deals have no financing
 * cost; hard money adds points (paid upfront, fraction of loan) plus monthly
 * interest. The simple model assumes interest-only debt service for non-cash
 * flips, which is the norm — conventional amortization adds tiny principal
 * paydown that doesn't materially change the grade.
 */
export function financingCosts(input: FixAndFlipInput): number {
  const type = effectiveFinancingType(input);
  if (type === "cash") return 0;

  const months = effectiveHoldMonths(input);
  const interestOverHold = monthlyLoanInterest(input) * months;

  if (type === "hard_money") {
    const pointsCost = (input.loanAmount ?? 0) * (input.points ?? 0);
    return pointsCost + interestOverHold;
  }
  // conventional + private: interest only (no points)
  return interestOverHold;
}

/**
 * Total project cost: acquisition, closing, contingency-adjusted rehab, full
 * monthly carry over the hold, exit selling costs against ARV, and financing
 * costs (points + interest).
 *
 * NOTE: `monthlyHoldingCosts` already includes `monthlyLoanInterest`, so we
 * count `interestOverHold` once via the holding-costs path. `financingCosts`
 * is then reduced to just points (hard money) or zero for the others, to
 * avoid double-counting. We implement that by subtracting interestOverHold
 * back out of financingCosts here.
 */
export function totalProjectCosts(input: FixAndFlipInput): number {
  const months = effectiveHoldMonths(input);
  const buyClosing = input.price * effectiveBuyClosingPct(input);
  const rehabAdjusted =
    input.rehabBudget * (1 + effectiveContingencyPct(input));
  const carry = monthlyHoldingCosts(input) * months;
  const sellingCosts = input.arv * effectiveSellingCostsPct(input);

  // Strip interest-over-hold out of financingCosts to avoid double-count
  // (carry already includes monthlyLoanInterest × months).
  const interestOverHold = monthlyLoanInterest(input) * months;
  const upfrontFinancingCosts = Math.max(
    0,
    financingCosts(input) - interestOverHold,
  );

  return (
    input.price +
    buyClosing +
    rehabAdjusted +
    carry +
    sellingCosts +
    upfrontFinancingCosts
  );
}

/**
 * Total cash the operator actually has at risk. Loan principal is the bank's
 * money; the operator's exposure is (purchase or downPayment) + closing +
 * out-of-pocket rehab + holding cash + points (paid in cash at close).
 *
 *   cash          purchase + closing + full rehab + holdingCashOOP
 *   conventional  downPayment + closing + full rehab + holdingCashOOP
 *   hard_money    (purchase - loanAmount) + closing + rehabNotFinanced
 *                 + holdingCashOOP + (loan × points)
 *   private       like conventional (no points typically)
 */
export function totalCashInvested(input: FixAndFlipInput): number {
  const type = effectiveFinancingType(input);
  const closing = input.closing ?? input.price * effectiveBuyClosingPct(input);
  const holdCash = input.holdingCashOutOfPocket ?? 0;

  if (type === "cash") {
    return input.price + closing + input.rehabBudget + holdCash;
  }

  const loan = input.loanAmount ?? 0;
  if (type === "hard_money") {
    const ownEquityIn = Math.max(0, input.price - loan);
    const rehabOOP = input.rehabNotFinanced ?? input.rehabBudget;
    const pointsCost = loan * (input.points ?? 0);
    return ownEquityIn + closing + rehabOOP + holdCash + pointsCost;
  }

  // conventional or private — operator funds full rehab and downpayment, no points
  const downPayment = input.downPayment ?? Math.max(0, input.price - loan);
  return downPayment + closing + input.rehabBudget + holdCash;
}

// ---- Return metrics --------------------------------------------------------

export function netProfit(input: FixAndFlipInput): number {
  return input.arv - totalProjectCosts(input);
}

export function netProfitMargin(input: FixAndFlipInput): number {
  if (input.arv <= 0) return 0;
  return netProfit(input) / input.arv;
}

export function cashOnCashROI(input: FixAndFlipInput): number {
  const cash = totalCashInvested(input);
  if (cash <= 0) return 0;
  return netProfit(input) / cash;
}

export function annualizedROI(input: FixAndFlipInput): number {
  const months = effectiveHoldMonths(input);
  if (months <= 0) return 0;
  return cashOnCashROI(input) * (12 / months);
}
