"use client";

import { useEffect, useRef } from "react";
import { useAnalyzerDefaults } from "@/lib/data";
import type { DealInput } from "@propertyiq/analyzer-core";
import type { AnalyzerAssumptions } from "./analyzer-assumptions";

type AssumptionSetter = <K extends keyof AnalyzerAssumptions>(
  key: K,
  value: AnalyzerAssumptions[K],
) => void;

interface PrefillTargets {
  setInput: (next: DealInput) => void;
  setAssumption: AssumptionSetter;
  currentInput: DealInput;
}

/**
 * Pre-fills the analyzer's form from the user's saved `user_preferences.analyzer_defaults`
 * exactly once per session. Fields split across two surfaces:
 *   - DealInput-owned: vacancyPctOfRent, maintenancePctOfRent, managementPctOfRent, financing.closingCostsPct
 *   - AnalyzerAssumptions-owned: rentGrowthPct, appreciationPct
 *   - capexPct + holdYears: no direct SFH-buy-and-hold form field; ignored.
 */
export function useAnalyzerDefaultsPrefill({
  setInput,
  setAssumption,
  currentInput,
}: PrefillTargets) {
  const { data } = useAnalyzerDefaults();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current || !data) return;

    const nextInput: DealInput = { ...currentInput };
    let inputChanged = false;
    if (data.vacancyPct != null) {
      nextInput.vacancyPctOfRent = data.vacancyPct;
      inputChanged = true;
    }
    if (data.maintenancePct != null) {
      nextInput.maintenancePctOfRent = data.maintenancePct;
      inputChanged = true;
    }
    if (data.pmPct != null) {
      nextInput.managementPctOfRent = data.pmPct;
      inputChanged = true;
    }
    if (data.closingCostsPct != null) {
      nextInput.financing = {
        ...nextInput.financing,
        closingCostsPct: data.closingCostsPct,
      };
      inputChanged = true;
    }
    if (inputChanged) setInput(nextInput);

    if (data.rentGrowthPct != null)
      setAssumption("rentGrowthPct", data.rentGrowthPct);
    if (data.appreciationPct != null)
      setAssumption("appreciationPct", data.appreciationPct);

    appliedRef.current = true;
  }, [data, setInput, setAssumption, currentInput]);
}
