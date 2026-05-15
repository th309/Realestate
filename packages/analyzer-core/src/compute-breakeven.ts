import type { DealInput, BreakEvenResult } from "./types";

/**
 * Break-even rent = monthly rent at which cashflow = 0.
 * Break-even occupancy = % of full rent at which cashflow = 0.
 * Pure.
 */
export function computeBreakEven(input: DealInput): BreakEvenResult {
  const loan = input.price * (1 - input.financing.downPaymentPct);
  const r = input.financing.interestRatePct / 100 / 12;
  const n = input.financing.termYears * 12;
  const monthlyPI = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));

  const monthlyTax = (input.taxAnnual ?? 0) / 12;
  const monthlyIns = (input.insuranceAnnual ?? 0) / 12;
  const monthlyHoa = input.hoaMonthly ?? 0;

  const vacancyPct = input.vacancyPctOfRent ?? 0.05;
  const maintPct = input.maintenancePctOfRent ?? 0.08;
  const mgmtPct = input.managementPctOfRent ?? 0.08;
  const variableCostPct = vacancyPct + maintPct + mgmtPct;

  const fixed = monthlyTax + monthlyIns + monthlyHoa;
  const breakEvenRent = (fixed + monthlyPI) / (1 - variableCostPct);

  const currentRent = input.rentMonthly ?? 0;
  const rentCushionPct =
    currentRent > 0
      ? Math.max(0, (currentRent - breakEvenRent) / currentRent)
      : 0;

  const breakEvenOccupancy = currentRent > 0 ? breakEvenRent / currentRent : 1;
  const clampedOccupancy = Math.max(0, Math.min(1, breakEvenOccupancy));
  const occupancyCushionPct = Math.max(0, 1 - clampedOccupancy);

  return {
    rentMonthly: breakEvenRent,
    occupancy: clampedOccupancy,
    rentCushionPct,
    occupancyCushionPct,
  };
}
