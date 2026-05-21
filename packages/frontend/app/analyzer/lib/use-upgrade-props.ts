"use client";

/**
 * Combined upgrade-path props for F&F and BRRRR. Calls both strategy hooks
 * and returns a single object the AnalyzerClient can spread onto
 * <GradingResultPanel {...upgradeProps} />. Each hook is lightweight (memo +
 * useCallback) so calling both unconditionally is fine — only the active
 * strategy's upgrade-path API call actually fires.
 */
import type { DealInput } from "@propertyiq/analyzer-core";
import type { AnalyzerAssumptions } from "./analyzer-assumptions";
import { useBrrrrUpgradeProps } from "./use-brrrr-upgrade-props";
import { useFlipUpgradeProps } from "./use-flip-upgrade-props";

export interface UseUpgradePropsArgs {
  input: DealInput;
  setInput: (next: DealInput | ((prev: DealInput) => DealInput)) => void;
  arvLocal: number;
  setArvLocal: (n: number) => void;
  rehabBudget: number;
  setRehabBudget: (n: number) => void;
  assumptions: AnalyzerAssumptions;
  setAssumption: <K extends keyof AnalyzerAssumptions>(
    key: K,
    value: AnalyzerAssumptions[K],
  ) => void;
  marketZip?: string;
  marketPiqScore?: number | null;
}

export function useUpgradeProps(args: UseUpgradePropsArgs) {
  const flipProps = useFlipUpgradeProps(args);
  const brrrrProps = useBrrrrUpgradeProps(args);
  return { ...flipProps, ...brrrrProps };
}
