/**
 * Cashflow summary primitives — gross rent, opex (annual), and vacancy
 * (monthly) derivations for the analyzer chrome (cashflow strip etc.).
 *
 * Extracted from AnalyzerClient to keep that file under the §1.3 limit.
 */
import type { DealInput, RentalResult } from "@propertyiq/analyzer-core";

export interface CashflowSummary {
  grossRentMonthly: number;
  debtServiceMonthly: number;
  opexAnnual: number;
  vacancyMonthly: number;
}

export function deriveCashflowSummary(
  input: DealInput,
  rental: RentalResult,
): CashflowSummary {
  const grossRentMonthly = input.rentMonthly ?? 0;
  const opexAnnual =
    (input.taxAnnual ?? 0) +
    (input.insuranceAnnual ?? 0) +
    (input.hoaMonthly ?? 0) * 12 +
    grossRentMonthly *
      12 *
      ((input.maintenancePctOfRent ?? 0.08) +
        (input.managementPctOfRent ?? 0.08));
  const vacancyMonthly = grossRentMonthly * (input.vacancyPctOfRent ?? 0.05);
  return {
    grossRentMonthly,
    debtServiceMonthly: rental.monthlyDebtService,
    opexAnnual,
    vacancyMonthly,
  };
}
