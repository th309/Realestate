"use client";

import { toEngineStrategy, useGradingResult } from "./use-grading-result";
import { useUpgradeProps } from "./use-upgrade-props";
import { useSectionAiInsights } from "./use-section-ai-insights";
import type { useAnalyzerState } from "./use-analyzer-state";
import type { Strategy } from "./strategy-tile-mappers";
import type { InvestorGoal } from "./goal-types";

/** The slice of `useAnalyzerState()` the service-backed derivations read. */
type AnalyzerStateSlice = Pick<
  ReturnType<typeof useAnalyzerState>,
  | "analyzer"
  | "arvLocal"
  | "setArvLocal"
  | "rehabBudget"
  | "setRehabBudget"
  | "assumptions"
  | "setAssumption"
  | "marketContext"
  | "piqByGeo"
  | "piqByGeoResolving"
  | "rentcastData"
  | "projection"
>;

export interface UseAnalyzerAnalysisArgs {
  state: AnalyzerStateSlice;
  isPro: boolean;
  activeStrategy: Strategy;
  hasGradableInput: boolean;
  /** Compare-mode goal that frames the narratives — null in focused mode. */
  activeGoal: InvestorGoal | null;
}

/**
 * The analyzer's service-backed derivations: the grade, the upgrade-path
 * nudges that hang off it, and the per-section AI narratives.
 *
 * Counterpart to `useDerivedAnalytics` (projection / break-even / after-tax),
 * which owns the derivations that are pure local math. These three are
 * grouped because they are one dependency chain, not merely three calls that
 * happen to be adjacent: `sectionAi` consumes `grading.data`, and both are
 * gated on the same `hasGradableInput`. Keeping that ordering here means
 * `AnalyzerClient` cannot reorder them into a stale read.
 */
export function useAnalyzerAnalysis({
  state,
  isPro,
  activeStrategy,
  hasGradableInput,
  activeGoal,
}: UseAnalyzerAnalysisArgs) {
  const {
    analyzer,
    arvLocal,
    rehabBudget,
    assumptions,
    marketContext,
    piqByGeo,
    rentcastData,
    projection,
  } = state;
  const marketZip = marketContext?.geo_id ?? undefined;
  const marketPiqScore = marketContext?.piq_score?.value;

  const grading = useGradingResult({
    input: analyzer.input,
    activeStrategy,
    hasGradableInput,
    piqScore: marketPiqScore,
    arv: arvLocal,
    rehabBudget,
    holdingMonths: assumptions.holdingMonths,
    sellingCostsPct: assumptions.sellingCostsPct,
    marketZip,
    refinanceLTVPct: assumptions.refinanceLTVPct,
    seasoningMonths: assumptions.seasoningMonths,
    rehabMonths: assumptions.rehabMonths,
  });

  const upgradeProps = useUpgradeProps({
    input: analyzer.input,
    setInput: analyzer.setInput,
    arvLocal,
    setArvLocal: state.setArvLocal,
    rehabBudget,
    setRehabBudget: state.setRehabBudget,
    assumptions,
    setAssumption: state.setAssumption,
    marketZip,
    marketPiqScore,
  });

  const sectionAi = useSectionAiInsights({
    enabled: isPro && hasGradableInput && !state.piqByGeoResolving, // see usePiqByGeo.isResolving
    input: analyzer.input,
    rental: analyzer.rental,
    flip: analyzer.flip,
    brrrr: analyzer.brrrr,
    rentcast: rentcastData,
    piq: marketContext,
    grading: grading.data ?? null,
    strategy: toEngineStrategy(activeStrategy) ?? null,
    piqByGeo,
    goal: activeGoal,
    projection,
  });

  return { grading, upgradeProps, sectionAi };
}
