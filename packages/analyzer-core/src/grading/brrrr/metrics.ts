/**
 * BRRRR grading metrics. BRRRR is a two-phase strategy and the math here
 * reflects that split:
 *
 *   ACQUISITION phase  — mirrors F&F's cost model. Hard-money points + monthly
 *                        interest during rehab/season, contingency-adjusted
 *                        rehab, monthly carry × hold months.
 *   REFINANCE event    — bank gives back (refiLtv × ARV) cash, less refi
 *                        closing costs, less whatever's left on the hard-money
 *                        balloon. What didn't come back is "cash left in deal".
 *   POST-REFI hold     — standard rental math against the new amortizing loan
 *                        (DSCR, cash flow per door, cap rate).
 *
 * All helpers take a `BrrrrGradingInput` and return a plain number. Shared
 * primitives live in ../shared/calculations.ts — this file does NOT duplicate
 * formulas like monthlyPI, dscr, or operatingExpensesAnnual.
 */
import {
  capRate as shCapRate,
  cashFlowPerDoorMonthly as shCashFlowPerDoorMonthly,
  dscr as shDscr,
  monthlyHoldingCosts as shMonthlyHoldingCosts,
  monthlyLoanInterest as shMonthlyLoanInterest,
  monthlyPI as shMonthlyPI,
  noiAnnual as shNoiAnnual,
} from "../shared/calculations";
import type { BrrrrGradingInput, BrrrrInitialFinancingType } from "./types";

const DEFAULTS = {
  buyClosingPct: 0.03,
  rehabContingencyPct: 0.1,
  refiClosingPct: 0.025,
  vacancyPct: 0.05,
  maintenancePct: 0.08,
  capexPct: 0,
  pmPct: 0.08,
  unitCount: 1,
};

// ---- Accessors / defaults --------------------------------------------------

export function effectiveContingencyPct(input: BrrrrGradingInput): number {
  return input.rehabContingencyPct ?? DEFAULTS.rehabContingencyPct;
}

export function effectiveBuyClosingPct(input: BrrrrGradingInput): number {
  return input.buyClosingPct ?? DEFAULTS.buyClosingPct;
}

export function effectiveRefiClosingPct(input: BrrrrGradingInput): number {
  return input.refiClosingPct ?? DEFAULTS.refiClosingPct;
}

export function effectiveVacancyPct(input: BrrrrGradingInput): number {
  return input.vacancyPct ?? DEFAULTS.vacancyPct;
}

export function effectiveMaintenancePct(input: BrrrrGradingInput): number {
  return input.maintenancePct ?? DEFAULTS.maintenancePct;
}

export function effectiveCapexPct(input: BrrrrGradingInput): number {
  return input.capexPct ?? DEFAULTS.capexPct;
}

export function effectivePmPct(input: BrrrrGradingInput): number {
  return input.pmPct ?? DEFAULTS.pmPct;
}

export function effectiveUnitCount(input: BrrrrGradingInput): number {
  return input.unitCount ?? DEFAULTS.unitCount;
}

export function effectiveFinancingType(
  input: BrrrrGradingInput,
): BrrrrInitialFinancingType {
  return input.initialFinancingType;
}

// ---- Acquisition phase -----------------------------------------------------

/**
 * Up-front hard-money points + total interest paid over the rehab/season hold.
 * Cash deals return 0. Interest accrues on the full hard-money balance for the
 * full hold (interest-only / balloon convention — accurate for short BRRRR
 * holds; the principal moves to the refi balance, not paid down).
 */
export function acquisitionFinancingCosts(input: BrrrrGradingInput): number {
  if (effectiveFinancingType(input) === "cash") return 0;
  const loan = input.hardMoneyLoanAmount ?? 0;
  const points = input.hardMoneyPoints ?? 0;
  const rate = input.hardMoneyRate ?? 0;
  const months = input.holdMonthsBeforeRefi;
  const pointsCost = loan * points;
  const interestOverHold = shMonthlyLoanInterest(loan, rate) * months;
  return pointsCost + interestOverHold;
}

/**
 * Monthly carry during the rehab/season hold — taxes, insurance, utilities,
 * HOA. Hard-money interest is NOT folded in here (it lives in
 * acquisitionFinancingCosts), so callers don't double-count.
 */
export function monthlyHoldingCarry(input: BrrrrGradingInput): number {
  return shMonthlyHoldingCosts({
    propertyTaxAnnual: input.propertyTaxAnnual,
    insuranceAnnual: input.insuranceAnnual,
    utilitiesMonthly: input.utilitiesMonthly ?? 0,
    hoaMonthly: input.hoaMonthly ?? 0,
    monthlyLoanInterest: 0,
  });
}

/**
 * All-in cost: purchase + buy closing + contingency-adjusted rehab + monthly
 * carry over the hold + acquisition financing costs (points + interest).
 *
 * "All-in" includes everything spent to bring the property to refi-ready,
 * which is the basis for the all-in-to-ARV ratio (the textbook 75% rule).
 */
export function allInCost(input: BrrrrGradingInput): number {
  const buyClosing = input.purchasePrice * effectiveBuyClosingPct(input);
  const rehabAdjusted = input.rehabCost * (1 + effectiveContingencyPct(input));
  const carry = monthlyHoldingCarry(input) * input.holdMonthsBeforeRefi;
  return (
    input.purchasePrice +
    buyClosing +
    rehabAdjusted +
    carry +
    acquisitionFinancingCosts(input)
  );
}

/** All-in / ARV — the canonical BRRRR ratio. Lower is better. */
export function allInToARVRatio(input: BrrrrGradingInput): number {
  if (input.arv <= 0) return 0;
  return allInCost(input) / input.arv;
}

/**
 * Operator's actual cash injected through the refi event. Loan principal is
 * the bank's money; we sum only what the operator is out-of-pocket on:
 *
 *   cash         purchase + closing + rehab + holding cash OOP
 *   hard_money   (purchase - loan) + closing + rehabNotFinanced
 *                + points (paid in cash at close)
 *                + holding cash OOP
 *                + interestPaidOutOfPocket (if any)
 */
export function totalCashInvested(input: BrrrrGradingInput): number {
  const closing = input.purchasePrice * effectiveBuyClosingPct(input);
  const holdCash = input.holdingCashOutOfPocket ?? 0;

  if (effectiveFinancingType(input) === "cash") {
    return input.purchasePrice + closing + input.rehabCost + holdCash;
  }

  const loan = input.hardMoneyLoanAmount ?? 0;
  const ownEquityIn = Math.max(0, input.purchasePrice - loan);
  const rehabOOP = input.rehabNotFinanced ?? input.rehabCost;
  const pointsCost = loan * (input.hardMoneyPoints ?? 0);
  const interestOOP = input.interestPaidOutOfPocket ?? 0;
  return ownEquityIn + closing + rehabOOP + pointsCost + holdCash + interestOOP;
}

// ---- Refinance event -------------------------------------------------------

/** New loan amount = refiLtv × ARV (capped at LTV ≤ 1 just in case). */
export function refiLoanAmount(input: BrrrrGradingInput): number {
  const ltv = Math.min(1, Math.max(0, input.refiLtvPct));
  return input.arv * ltv;
}

/** Refi closing costs (paid out of the new loan proceeds). */
export function refiClosingCosts(input: BrrrrGradingInput): number {
  return refiLoanAmount(input) * effectiveRefiClosingPct(input);
}

/**
 * Balance to pay off at refi. For BRRRR with a hard-money balloon, this is
 * just the hard-money principal (interest-only, no paydown). Cash deals owe
 * nothing.
 */
export function initialLoanPayoffAtRefi(input: BrrrrGradingInput): number {
  if (effectiveFinancingType(input) === "cash") return 0;
  return input.hardMoneyLoanAmount ?? 0;
}

/**
 * Net cash the operator receives at the refinance event. Can be negative if
 * the new loan doesn't even cover the existing balloon + closing — that's a
 * "needs cash to refi" outcome and shows up downstream as a large
 * cash-left-in-deal.
 */
export function cashOutAtRefi(input: BrrrrGradingInput): number {
  return (
    refiLoanAmount(input) -
    refiClosingCosts(input) -
    initialLoanPayoffAtRefi(input)
  );
}

/**
 * Cash left in deal = operator's total cash in − cash returned at refi.
 * Clamped at 0 from below — if refi gives back MORE than was invested, the
 * deal is "infinite return" and we don't penalize for negative cash left.
 *
 * This is the headline BRRRR metric: A=0 means full capital recovery (do it
 * again with the same dollar).
 */
export function cashLeftInDeal(input: BrrrrGradingInput): number {
  const left = totalCashInvested(input) - cashOutAtRefi(input);
  return Math.max(0, left);
}

/** What fraction of invested cash came back at refi. Higher is better. */
export function capitalRecoveryPct(input: BrrrrGradingInput): number {
  const invested = totalCashInvested(input);
  if (invested <= 0) return 1;
  return Math.min(1, Math.max(0, cashOutAtRefi(input) / invested));
}

// ---- Post-refi hold (rental) ----------------------------------------------

/** New amortizing P&I against the refi loan. */
export function postRefiMonthlyPI(input: BrrrrGradingInput): number {
  return shMonthlyPI(
    refiLoanAmount(input),
    input.refiRate,
    input.refiTermYears,
  );
}

export function postRefiDebtServiceAnnual(input: BrrrrGradingInput): number {
  return postRefiMonthlyPI(input) * 12;
}

function noiOpts(input: BrrrrGradingInput) {
  return {
    monthlyRent: input.monthlyRent,
    vacancyPct: effectiveVacancyPct(input),
    maintenancePct: effectiveMaintenancePct(input),
    capexPct: effectiveCapexPct(input),
    pmPct: effectivePmPct(input),
    propertyTaxAnnual: input.propertyTaxAnnual,
    insuranceAnnual: input.insuranceAnnual,
    hoaMonthly: input.hoaMonthly ?? 0,
  };
}

export function postRefiNOI(input: BrrrrGradingInput): number {
  return shNoiAnnual(noiOpts(input));
}

export function postRefiDSCR(input: BrrrrGradingInput): number {
  return shDscr(postRefiNOI(input), postRefiDebtServiceAnnual(input));
}

/** Monthly pretax cash flow after the refi (NOI/12 − debt service/12). */
export function postRefiCashFlowMonthly(input: BrrrrGradingInput): number {
  return (postRefiNOI(input) - postRefiDebtServiceAnnual(input)) / 12;
}

export function postRefiCashFlowPerDoorMonthly(
  input: BrrrrGradingInput,
): number {
  const annualCF = postRefiNOI(input) - postRefiDebtServiceAnnual(input);
  return shCashFlowPerDoorMonthly(annualCF, effectiveUnitCount(input));
}

/** Post-refi cap rate against ARV — what the asset yields after stabilization. */
export function postRefiCapRate(input: BrrrrGradingInput): number {
  return shCapRate(postRefiNOI(input), input.arv);
}

// ---- Time ------------------------------------------------------------------

export function timeToRefinanceMonths(input: BrrrrGradingInput): number {
  return input.holdMonthsBeforeRefi;
}
