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
  /**
   * False when resuming a saved deal. Those values ARE the user's choices for
   * this deal — overwriting them with the global defaults on open discards
   * the tuning AND (via autosave) persists the discarding, turning a page
   * view into a destructive write. Defaults to true for a fresh analysis.
   */
  enabled?: boolean;
}

/**
 * Applies the user's saved `user_preferences.analyzer_defaults` to the
 * analyzer form: once on load, and again whenever the saved defaults CHANGE
 * (i.e. the user saves the Customize drawer) so the open analysis reflects
 * the new assumptions immediately instead of on the next page load.
 * Fields split across two surfaces:
 *   - DealInput-owned: vacancyPctOfRent, maintenancePctOfRent, managementPctOfRent, financing.closingCostsPct
 *   - AnalyzerAssumptions-owned: rentGrowthPct, appreciationPct, marginalTaxRate,
 *     landValuePct (from landValueSharePct), expenseGrowthPct
 *   - capexPct + holdYears: no direct SFH-buy-and-hold form field; ignored.
 */
export function useAnalyzerDefaultsPrefill({
  setInput,
  setAssumption,
  currentInput,
  enabled = true,
}: PrefillTargets) {
  const { data } = useAnalyzerDefaults();
  // Snapshot of the defaults we last applied — re-apply only when the saved
  // content actually changes, never on unrelated re-renders / input edits.
  const appliedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data || !enabled) return;
    const snapshot = JSON.stringify(data);
    if (appliedForRef.current === snapshot) return;

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
    if (data.marginalTaxRatePct != null)
      setAssumption("marginalTaxRate", data.marginalTaxRatePct);
    if (data.landValueSharePct != null)
      setAssumption("landValuePct", data.landValueSharePct);
    if (data.expenseGrowthPct != null)
      setAssumption("expenseGrowthPct", data.expenseGrowthPct);

    appliedForRef.current = snapshot;
  }, [data, enabled, setInput, setAssumption, currentInput]);
}
