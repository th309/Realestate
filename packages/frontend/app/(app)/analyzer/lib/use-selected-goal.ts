"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BrrrrResult,
  FlipResult,
  ProjectionResult,
  RentalResult,
} from "@propertyiq/analyzer-core";
import type { AnalysisMode } from "../components/InputPanel/StrategyControls";
import type { AnalyzerAssumptions } from "./analyzer-assumptions";
import type { Strategy } from "./strategy-tile-mappers";
import type { InvestorGoal } from "./goal-types";
import {
  inferDefaultGoal,
  pickBestPlayForGoal,
  type ScoringInput,
} from "./goal-scoring";
import { computeBestPlay } from "./strategy-best-play";

const STORAGE_KEY = "analyzer.investorGoal";

function isInvestorGoal(value: string | null): value is InvestorGoal {
  return (
    value === "cash_flow" ||
    value === "long_term_wealth" ||
    value === "fast_cash" ||
    value === "recycle_capital"
  );
}

interface AnalyzerBundle {
  rental: RentalResult;
  flip: FlipResult | null;
  brrrr: BrrrrResult | null;
}

interface UseSelectedGoalResult {
  /** Raw picker state. Compare-mode UI only — see `activeGoal`. */
  selectedGoal: InvestorGoal | null;
  /**
   * The goal that actually frames this analysis: `selectedGoal` in compare
   * mode, `null` everywhere else. Anything user-facing (the AI payload, the
   * saved snapshot) MUST read this rather than `selectedGoal`, or a goal the
   * user can't see on the current screen ends up framing their narrative.
   */
  activeGoal: InvestorGoal | null;
  setSelectedGoal: (goal: InvestorGoal) => void;
  bestPlay: Strategy;
  /** True when a goal is selected in compare mode but no strategy scores
   *  positively for that goal — UI should surface a "no strategy fits this
   *  goal" callout instead of crowning a fallback winner. */
  noGoalFit: boolean;
}

/**
 * Owns the "Help me decide" goal-aware state: which goal the user has
 * selected, persistence across reloads, and the derived best-play that
 * overrides the deterministic `computeBestPlay` when a goal is active in
 * compare mode. Auto-pre-selects the inferred default goal once the deal
 * becomes gradable so the user always sees a recommendation tied to a goal.
 *
 * IMPORTANT — the returned `selectedGoal` is COMPARE-MODE state. It is
 * deliberately persisted globally (not per-property): a goal is a standing
 * investing preference, so carrying "I'm optimizing for cash flow" onto the
 * next deal you compare is the desired behavior.
 *
 * The consequence is that `selectedGoal` can be non-null while the user is
 * looking at focused mode, where GoalPicker isn't rendered and the strategy is
 * chosen directly. Callers must NOT feed it to anything user-facing in that
 * state — AnalyzerClient derives `activeGoal` (null outside compare mode) for
 * exactly this reason.
 *
 * The bug that motivated the rule: a goal auto-inferred during one compare
 * session (say `fast_cash`) persisted to localStorage, then framed every
 * later focused-mode analysis, because the AI payload took `selectedGoal`
 * unconditionally and the recommendation prompt names the goal in its opening
 * sentence. Buy-and-hold analyses opened with "your goal is fast cash within
 * 12 months" — a goal the user could neither see nor change on that screen.
 */
export function useSelectedGoal(
  analyzer: AnalyzerBundle,
  projection: ProjectionResult,
  assumptions: AnalyzerAssumptions,
  analysisMode: AnalysisMode,
  hasGradableInput: boolean,
): UseSelectedGoalResult {
  const { rental, flip, brrrr } = analyzer;
  const defaultBestPlay = computeBestPlay(rental, flip, brrrr, projection);
  const [selectedGoal, setSelectedGoal] = useState<InvestorGoal | null>(null);
  // Gates the auto-infer effect below. Both effects run in the same commit on
  // mount, so without this the inference reads `selectedGoal` as null (the
  // hydrate's setState hasn't been applied yet in that pass), infers a
  // default, and its setter lands LAST — silently overwriting the goal the
  // user actually chose on their previous visit.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isInvestorGoal(saved)) setSelectedGoal(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedGoal == null) return;
    window.localStorage.setItem(STORAGE_KEY, selectedGoal);
  }, [selectedGoal]);

  const scoringInput: ScoringInput = useMemo(
    () => ({
      rental,
      flip,
      brrrr,
      projection,
      holdMonths: assumptions.holdingMonths,
      refiSeasoningMonths: assumptions.seasoningMonths,
    }),
    [
      rental,
      flip,
      brrrr,
      projection,
      assumptions.holdingMonths,
      assumptions.seasoningMonths,
    ],
  );

  useEffect(() => {
    // Never infer before we know whether the user already has a saved goal.
    if (!hydrated) return;
    if (analysisMode !== "compare") return;
    if (selectedGoal != null) return;
    if (!hasGradableInput) return;
    setSelectedGoal(inferDefaultGoal(scoringInput));
  }, [hydrated, analysisMode, selectedGoal, hasGradableInput, scoringInput]);

  const goalBestPlay =
    analysisMode === "compare" && selectedGoal
      ? pickBestPlayForGoal(selectedGoal, scoringInput)
      : null;

  const bestPlay: Strategy =
    (goalBestPlay as Strategy | null) ?? defaultBestPlay;

  const noGoalFit =
    analysisMode === "compare" && selectedGoal != null && goalBestPlay === null;

  // GoalPicker renders in compare mode only, so outside it the goal is state
  // the user can neither see nor change — usually inherited from localStorage
  // or auto-inferred during an earlier compare session on a different deal.
  const activeGoal = analysisMode === "compare" ? selectedGoal : null;

  return { selectedGoal, activeGoal, setSelectedGoal, bestPlay, noGoalFit };
}
