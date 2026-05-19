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
  selectedGoal: InvestorGoal | null;
  setSelectedGoal: (goal: InvestorGoal) => void;
  bestPlay: Strategy;
}

/**
 * Owns the "Help me decide" goal-aware state: which goal the user has
 * selected, persistence across reloads, and the derived best-play that
 * overrides the deterministic `computeBestPlay` when a goal is active in
 * compare mode. Auto-pre-selects the inferred default goal once the deal
 * becomes gradable so the user always sees a recommendation tied to a goal.
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isInvestorGoal(saved)) setSelectedGoal(saved);
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
    if (analysisMode !== "compare") return;
    if (selectedGoal != null) return;
    if (!hasGradableInput) return;
    setSelectedGoal(inferDefaultGoal(scoringInput));
  }, [analysisMode, selectedGoal, hasGradableInput, scoringInput]);

  const goalBestPlay =
    analysisMode === "compare" && selectedGoal
      ? pickBestPlayForGoal(selectedGoal, scoringInput)
      : null;

  const bestPlay: Strategy =
    (goalBestPlay as Strategy | null) ?? defaultBestPlay;

  return { selectedGoal, setSelectedGoal, bestPlay };
}
