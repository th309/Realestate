// Caller (gradeDeal) guarantees rentMonthly is a positive number and price > 0.
// The opex math here mirrors rental.ts so the grading engine and rental engine
// stay numerically consistent for SFH (residential) deals.

import type { DealInput } from "../types";

const DEFAULTS = {
  maintenance: 0.08,
  vacancy: 0.05,
  management: 0.08,
};

export function annualGrossRent(input: DealInput): number {
  const rent = input.rentMonthly ?? 0;
  return rent * 12;
}

/**
 * Annual operating expenses, EXCLUDING vacancy loss. Vacancy is modeled as a
 * top-line reduction (see annualVacancyLoss) in line with how rental.ts treats
 * it when computing NOI.
 */
export function annualOperatingExpenses(input: DealInput): number {
  const grossRent = annualGrossRent(input);
  const maintPct = input.maintenancePctOfRent ?? DEFAULTS.maintenance;
  const mgmtPct = input.managementPctOfRent ?? DEFAULTS.management;
  const maintCost = grossRent * maintPct;
  const mgmtCost = grossRent * mgmtPct;
  const hoaAnnual = (input.hoaMonthly ?? 0) * 12;
  return (
    (input.taxAnnual ?? 0) +
    (input.insuranceAnnual ?? 0) +
    maintCost +
    mgmtCost +
    hoaAnnual
  );
}

export function annualVacancyLoss(input: DealInput): number {
  const vacPct = input.vacancyPctOfRent ?? DEFAULTS.vacancy;
  return annualGrossRent(input) * vacPct;
}

export function cashFlowPerDoor(
  annualPretaxCashFlow: number,
  unitCount: number,
): number {
  const units = unitCount > 0 ? unitCount : 1;
  return annualPretaxCashFlow / 12 / units;
}

/**
 * Fraction of full occupancy required to cover opex + debt service. Lower is
 * better. Returns Infinity when there is no rent to anchor the ratio against.
 */
export function breakEvenOccupancy(
  input: DealInput,
  annualDebtService: number,
): number {
  const grossRent = annualGrossRent(input);
  if (grossRent <= 0) return Number.POSITIVE_INFINITY;
  return (annualOperatingExpenses(input) + annualDebtService) / grossRent;
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
