import type { DealInput, FinancingTerms } from "@propertyiq/analyzer-core";

const DEFAULT_FINANCING: FinancingTerms = {
  downPaymentPct: 0.2,
  interestRatePct: 7.1,
  termYears: 30,
  closingCostsPct: 0.03,
};

function num(v: unknown, fallback: number | null = null): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))
    return Number(v);
  return fallback;
}

export function migrateSnapshot(raw: unknown): DealInput {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const fin = obj.financing as Record<string, unknown> | undefined;

  return {
    price: num(obj.price, 0) ?? 0,
    rentMonthly: num(obj.rentMonthly, null),
    taxAnnual: num(obj.taxAnnual, null),
    insuranceAnnual: num(obj.insuranceAnnual, null),
    hoaMonthly: num(obj.hoaMonthly, 0) ?? 0,
    financing: fin
      ? {
          downPaymentPct:
            num(fin.downPaymentPct, DEFAULT_FINANCING.downPaymentPct) ??
            DEFAULT_FINANCING.downPaymentPct,
          interestRatePct:
            num(fin.interestRatePct, DEFAULT_FINANCING.interestRatePct) ??
            DEFAULT_FINANCING.interestRatePct,
          termYears:
            num(fin.termYears, DEFAULT_FINANCING.termYears) ??
            DEFAULT_FINANCING.termYears,
          closingCostsPct:
            num(fin.closingCostsPct, DEFAULT_FINANCING.closingCostsPct) ??
            DEFAULT_FINANCING.closingCostsPct,
        }
      : { ...DEFAULT_FINANCING },
  };
}
