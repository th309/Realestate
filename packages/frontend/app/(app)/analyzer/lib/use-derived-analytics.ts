"use client";

/**
 * useDerivedAnalytics — the pure derived-math cluster for the analyzer page:
 * 30-year projection, sensitivity, after-tax cashflow, break-even, and the
 * BRRRR timeline, each memoized on exactly the inputs/assumptions it consumes.
 * Split out of use-analyzer-state.ts (CLAUDE.md §1.3 file-size limit).
 */

import { useMemo } from "react";
import {
  computeAfterTax,
  computeBreakEven,
  computeBrrrrTimeline,
  computeProjection,
  computeSensitivity,
  type DealInput,
} from "@propertyiq/analyzer-core";
import type { AnalyzerAssumptions } from "./analyzer-assumptions";

export function useDerivedAnalytics(
  input: DealInput,
  assumptions: AnalyzerAssumptions,
  arvLocal: number,
  rehabBudget: number,
) {
  const projection = useMemo(
    () =>
      computeProjection(input, {
        appreciationPct: assumptions.appreciationPct,
        rentGrowthPct: assumptions.rentGrowthPct,
        expenseGrowthPct: assumptions.expenseGrowthPct,
      }),
    [
      input,
      assumptions.appreciationPct,
      assumptions.rentGrowthPct,
      assumptions.expenseGrowthPct,
    ],
  );
  const sensitivity = useMemo(() => computeSensitivity(input), [input]);
  const afterTax = useMemo(
    () =>
      computeAfterTax(input, {
        marginalTaxRate: assumptions.marginalTaxRate,
        landValuePct: assumptions.landValuePct,
        rentGrowthPct: assumptions.rentGrowthPct,
        expenseGrowthPct: assumptions.expenseGrowthPct,
      }),
    [
      input,
      assumptions.marginalTaxRate,
      assumptions.landValuePct,
      assumptions.rentGrowthPct,
      assumptions.expenseGrowthPct,
    ],
  );
  const breakEven = useMemo(() => computeBreakEven(input), [input]);
  const brrrrTimeline = useMemo(
    () =>
      computeBrrrrTimeline(
        { ...input, arv: arvLocal, rehabBudget },
        {
          seasoningMonths: assumptions.seasoningMonths,
          rehabMonths: assumptions.rehabMonths,
          leaseMonths: assumptions.leaseMonths,
        },
      ),
    [
      input,
      arvLocal,
      rehabBudget,
      assumptions.seasoningMonths,
      assumptions.rehabMonths,
      assumptions.leaseMonths,
    ],
  );

  return { projection, sensitivity, afterTax, breakEven, brrrrTimeline };
}
