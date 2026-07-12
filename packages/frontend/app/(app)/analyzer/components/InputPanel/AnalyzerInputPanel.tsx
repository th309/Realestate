"use client";

import { useRouter } from "next/navigation";
import { InputPanel } from "./InputPanel";
import type { AnalysisMode } from "./StrategyControls";
import type { useAnalyzerState } from "../../lib/use-analyzer-state";
import type { Strategy } from "../../lib/strategy-tile-mappers";

interface AnalyzerInputPanelProps {
  state: ReturnType<typeof useAnalyzerState>;
  isPro: boolean;
  activeStrategy: Strategy;
  analysisMode: AnalysisMode;
  onAnalysisModeChange: (m: AnalysisMode) => void;
  onStrategyChange: (s: Strategy) => void;
  onCustomizeClick?: () => void;
}

/**
 * Binds analyzer-page state (from `useAnalyzerState`) to `InputPanel`. Split
 * out of `AnalyzerClient.tsx` purely to keep that file under the file-size
 * hard limit — this component has no state of its own beyond the URL-persist
 * side effect in `onFetchProperty`.
 */
export function AnalyzerInputPanel({
  state,
  isPro,
  activeStrategy,
  analysisMode,
  onAnalysisModeChange,
  onStrategyChange,
  onCustomizeClick,
}: AnalyzerInputPanelProps) {
  const router = useRouter();
  const {
    analyzer,
    address,
    setAddress,
    arvLocal,
    setArvLocal,
    rehabBudget,
    setRehabBudget,
    assumptions,
    setAssumption,
    propertyType,
    setPropertyType,
    unitCount,
    setUnitCount,
    propertyClass,
    propertyLookup,
    rentcastData,
    provenance,
    handleAddressSelect,
  } = state;
  const { rental, flip, brrrr } = analyzer;

  return (
    <InputPanel
      input={analyzer.input}
      arv={arvLocal}
      onChange={analyzer.setInput}
      onArvChange={setArvLocal}
      rehabBudget={rehabBudget}
      onRehabBudgetChange={setRehabBudget}
      assumptions={assumptions}
      onAssumptionChange={setAssumption}
      address={address}
      onAddressChange={setAddress}
      isPro={isPro}
      isFetching={propertyLookup.isPending}
      onFetchProperty={() => {
        // Persist the address to the URL so a page refresh re-fires the
        // auto-fetch path in use-analyzer-state.ts. Combined with the 30-day
        // Redis cache on the backend, refresh becomes ~instant — no second
        // RentCast roundtrip needed for the same address.
        const trimmed = address.trim();
        if (trimmed.length > 0) {
          const next = `/analyzer?address=${encodeURIComponent(trimmed)}`;
          router.replace(next);
        }
        propertyLookup.mutate({ address });
      }}
      rentCastState={rentcastData ? "fresh" : "missing"}
      activeStrategy={activeStrategy}
      analysisMode={analysisMode}
      onAnalysisModeChange={onAnalysisModeChange}
      onStrategyChange={onStrategyChange}
      propertyType={propertyType}
      onPropertyTypeChange={setPropertyType}
      unitCount={unitCount}
      onUnitCountChange={setUnitCount}
      propertyClass={propertyClass}
      rental={rental}
      flip={flip}
      brrrr={brrrr}
      provenance={provenance}
      onAddressSelect={handleAddressSelect}
      onCustomizeClick={onCustomizeClick}
    />
  );
}
