// Caller (gradeBuyAndHoldDeal) guarantees rentMonthly is a positive number
// and price > 0. The opex math here mirrors rental.ts so the grading engine
// and rental engine stay numerically consistent for SFH (residential) deals.
//
// Each helper here is a thin adapter: takes the strategy-specific
// `DealInput` shape, resolves defaults, and delegates the actual math to
// the primitive in `../shared/calculations`. Public signatures preserved
// exactly so existing tests + callers keep working.

import type { DealInput } from "../../types";
import {
  breakEvenOccupancy as shBreakEvenOccupancy,
  cashFlowPerDoorMonthly,
  operatingExpensesAnnual,
} from "../shared/calculations";

const DEFAULTS = {
  maintenance: 0.08,
  vacancy: 0.05,
  management: 0.08,
};

/** Resolve the rent-derived opts that every B&H opex/NOI consumer needs. */
function rentalOpts(input: DealInput) {
  return {
    monthlyRent: input.rentMonthly ?? 0,
    maintenancePct: input.maintenancePctOfRent ?? DEFAULTS.maintenance,
    pmPct: input.managementPctOfRent ?? DEFAULTS.management,
    capexPct: 0, // B&H bundles capex into maintenancePctOfRent (rule of thumb)
    propertyTaxAnnual: input.taxAnnual ?? 0,
    insuranceAnnual: input.insuranceAnnual ?? 0,
    hoaMonthly: input.hoaMonthly ?? 0,
  } as const;
}

export function annualGrossRent(input: DealInput): number {
  return (input.rentMonthly ?? 0) * 12;
}

/**
 * Annual operating expenses, EXCLUDING vacancy loss. Vacancy is modeled as
 * a top-line reduction (see annualVacancyLoss) in line with how rental.ts
 * treats it when computing NOI.
 */
export function annualOperatingExpenses(input: DealInput): number {
  return operatingExpensesAnnual(rentalOpts(input));
}

export function annualVacancyLoss(input: DealInput): number {
  const vacPct = input.vacancyPctOfRent ?? DEFAULTS.vacancy;
  return annualGrossRent(input) * vacPct;
}

export function cashFlowPerDoor(
  annualPretaxCashFlow: number,
  unitCount: number,
): number {
  return cashFlowPerDoorMonthly(annualPretaxCashFlow, unitCount);
}

/**
 * Fraction of full occupancy required to cover opex + debt service. Lower
 * is better. Returns Infinity when there is no rent to anchor the ratio.
 */
export function breakEvenOccupancy(
  input: DealInput,
  annualDebtService: number,
): number {
  return shBreakEvenOccupancy(
    annualOperatingExpenses(input),
    annualDebtService,
    annualGrossRent(input),
  );
}

export function grm(input: DealInput): number {
  const grossRent = annualGrossRent(input);
  if (grossRent <= 0) return Number.POSITIVE_INFINITY;
  return input.price / grossRent;
}

export function opexRatio(input: DealInput): number {
  const grossRent = annualGrossRent(input);
  if (grossRent <= 0) return Number.POSITIVE_INFINITY;
  return annualOperatingExpenses(input) / grossRent;
}
