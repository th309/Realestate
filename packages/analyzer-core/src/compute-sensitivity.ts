import type { DealInput, SensitivityResult } from "./types";
import { computeProjection } from "./compute-projection";

/**
 * Tornado: shifts each of 6 inputs by ±10% and measures IRR(10y) impact.
 * Pure. Identical inputs → identical output.
 */
export function computeSensitivity(input: DealInput): SensitivityResult {
  const base = computeProjection(input).horizons.y10.irr;

  const factors: SensitivityResult["factors"] = [
    sensitivityFor("rate", input, base, (i, mult) => ({
      ...i,
      financing: {
        ...i.financing,
        interestRatePct: i.financing.interestRatePct * mult,
      },
    })),
    sensitivityFor("rent", input, base, (i, mult) => ({
      ...i,
      rentMonthly: i.rentMonthly == null ? null : i.rentMonthly * mult,
    })),
    sensitivityFor("vacancy", input, base, (i, mult) => ({
      ...i,
      vacancyPctOfRent: (i.vacancyPctOfRent ?? 0.05) * mult,
    })),
    sensitivityFor("taxes", input, base, (i, mult) => ({
      ...i,
      taxAnnual: i.taxAnnual == null ? null : i.taxAnnual * mult,
    })),
    sensitivityFor("insurance", input, base, (i, mult) => ({
      ...i,
      insuranceAnnual:
        i.insuranceAnnual == null ? null : i.insuranceAnnual * mult,
    })),
    sensitivityFor("exitCap", input, base, (i, _mult) => ({
      ...i,
      // exitCap not directly modeled in computeProjection — sensitivity is 0
      // (placeholder — see plan note: sensitivity vs exit cap is computed
      //  by varying terminal property value, which we don't currently expose
      //  through opts. Return 0 impact for now to keep the 6-factor surface.)
    })),
  ];

  factors.sort((a, b) => b.impactMagnitude - a.impactMagnitude);

  return { baseIRR: base, factors };
}

function sensitivityFor(
  name: SensitivityResult["factors"][number]["name"],
  input: DealInput,
  baseIRR: number,
  mutate: (i: DealInput, mult: number) => DealInput,
): SensitivityResult["factors"][number] {
  const irrMinus = computeProjection(mutate(input, 0.9)).horizons.y10.irr;
  const irrPlus = computeProjection(mutate(input, 1.1)).horizons.y10.irr;
  const impactMagnitude = Math.max(
    Math.abs(irrMinus - baseIRR),
    Math.abs(irrPlus - baseIRR),
  );
  return {
    name,
    irrAtMinus10pct: irrMinus,
    irrAtPlus10pct: irrPlus,
    impactMagnitude,
  };
}
