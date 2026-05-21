import { useMemo, useState } from "react";
import {
  computeRentalMetrics,
  computeFlipMetrics,
  computeBrrrrScore,
} from "@propertyiq/analyzer-core";
import type { DealInput, FinancingTerms } from "@propertyiq/analyzer-core";

/**
 * Default financing terms used when the user hasn't tweaked the inputs.
 * Mirrors current market 30y fixed averages; not user-locale aware.
 */
const DEFAULT_FINANCING: FinancingTerms = {
  downPaymentPct: 0.2,
  interestRatePct: 7.1,
  termYears: 30,
  closingCostsPct: 0.03,
};

export interface AnalyzerInputState extends DealInput {
  arv?: number;
  rehabBudget?: number;
  /** Flip-only: months held before sale. Default 4. */
  holdingMonths?: number;
  /** Flip-only: selling costs as % of ARV. Default 0.07. */
  sellingCostsPct?: number;
  /** BRRRR-only: refi LTV cap. Default 0.75. */
  refinanceLTVPct?: number;
}

/**
 * Local-only orchestrator hook for the Deal Analyzer.
 *
 * Holds the editable input state and recomputes rental / flip / BRRRR
 * metrics via the pure `@propertyiq/analyzer-core` helpers. No API round
 * trips happen for math edits — only when the consumer calls one of the
 * dedicated fetchers (e.g. `useMarketContext`, `saveAnalysis`).
 */
export function useAnalyzer(initial?: Partial<AnalyzerInputState>) {
  const [input, setInput] = useState<AnalyzerInputState>({
    price: 0,
    rentMonthly: null,
    taxAnnual: null,
    insuranceAnnual: null,
    financing: DEFAULT_FINANCING,
    ...initial,
  });

  const rental = useMemo(() => computeRentalMetrics(input), [input]);

  const flip = useMemo(() => {
    if (input.arv == null || input.rehabBudget == null) return null;
    return computeFlipMetrics({
      price: input.price,
      arv: input.arv,
      rehabBudget: input.rehabBudget,
      holdingMonths: input.holdingMonths,
      sellingCostsPct: input.sellingCostsPct,
    });
  }, [input]);

  const brrrr = useMemo(() => {
    if (input.arv == null || input.rehabBudget == null) return null;
    return computeBrrrrScore({
      ...input,
      arv: input.arv,
      rehabBudget: input.rehabBudget,
      refinanceLTVPct: input.refinanceLTVPct,
    });
  }, [input]);

  const setField = <K extends keyof AnalyzerInputState>(
    key: K,
    value: AnalyzerInputState[K],
  ) => setInput((prev) => ({ ...prev, [key]: value }));

  const setFinancing = <K extends keyof FinancingTerms>(
    key: K,
    value: FinancingTerms[K],
  ) =>
    setInput((prev) => ({
      ...prev,
      financing: { ...prev.financing, [key]: value },
    }));

  return { input, setField, setFinancing, setInput, rental, flip, brrrr };
}
