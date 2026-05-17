"use client";

import { useGradeDeal } from "@/lib/data";
import type {
  DealInput,
  Strategy as EngineStrategy,
} from "@propertyiq/analyzer-core";
import type { Strategy as AnalyzerStrategy } from "./strategy-tile-mappers";

const STRATEGY_MAP: Partial<Record<AnalyzerStrategy, EngineStrategy>> = {
  buyAndHold: "BUY_AND_HOLD",
  flip: "FIX_AND_FLIP",
  brrrr: "BRRRR",
};

export function toEngineStrategy(
  s: AnalyzerStrategy,
): EngineStrategy | undefined {
  return STRATEGY_MAP[s];
}

export interface UseGradingResultArgs {
  input: DealInput;
  activeStrategy: AnalyzerStrategy;
  hasGradableInput: boolean;
  piqScore?: number | null;
}

/**
 * Wires the analyzer's reactive input → POST /api/analyzer/grade.
 *
 * Only fires for BUY_AND_HOLD at the moment (Prompt 1's grading engine is
 * SFH-buy-and-hold only). Flip/BRRRR are reserved for future prompts and
 * are kept disabled so the panel renders nothing rather than 500ing.
 */
export function useGradingResult({
  input,
  activeStrategy,
  hasGradableInput,
  piqScore,
}: UseGradingResultArgs) {
  const strategy = STRATEGY_MAP[activeStrategy];
  return useGradeDeal(
    hasGradableInput && strategy
      ? {
          strategy,
          input,
          context: { marketPiqScore: piqScore ?? undefined },
        }
      : null,
    { enabled: hasGradableInput && strategy === "BUY_AND_HOLD" },
  );
}
