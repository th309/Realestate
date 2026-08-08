"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAnalyzer } from "@/lib/analyzer/useAnalyzer";
import { useDerivedAnalytics } from "./use-derived-analytics";
import {
  usePropertyLookup,
  useAiHeaderVerdict,
  useMarketContext,
  useAnalyzerPrefill,
  type PropertyLookupResult,
} from "@/lib/data";
import type { AddressSuggestion } from "@/lib/analyzer/types";
import {
  DEFAULT_ASSUMPTIONS,
  type AnalyzerAssumptions,
} from "./analyzer-assumptions";
import { derivePropertyClass } from "./derive-property-class";
import { usePiqByGeo } from "./use-piq-by-geo";
import {
  buildProvenanceFromBundle,
  mergeRentcastIntoInput,
  type AnalyzerStateOptions,
  type FieldProvenance,
  type ProvenanceMap,
  isDivergent,
} from "./use-analyzer-state.provenance";
import { resolveMarketZip } from "./resolve-market-zip";
import { getScoreLabel } from "@/app/components/scoring/score-labels";
import {
  pickMarketContext,
  resolveInitialAnalyzerState,
  shouldAutoFetchProperty,
  useMarketRefreshGate,
} from "./use-analyzer-state.hydration";
import type { MarketContext } from "@/lib/data/fetchers/analyzer";

export type { FieldProvenance, ProvenanceMap };
export { isDivergent };
export type { AnalyzerAssumptions };
export { DEFAULT_ASSUMPTIONS };
// Re-exported so callers (and its test) keep importing the auto-fetch guard
// from here; it lives in use-analyzer-state.hydration.ts for the line limit.
export { shouldAutoFetchProperty };

/**
 * Combines all the analyzer state + side effects into one consumable hook so
 * `AnalyzerClient.tsx` stays a thin coordinator.
 *
 * Side effects encapsulated here:
 *   - RentCast fetch (mutation) + sync result to input fields once per fetch
 *   - Auto-fetch on first render when address arrives via ?address= param
 *   - Market context + per-geo PIQ, gated so a hydrated deal restores rather
 *     than refetches them (useMarketRefreshGate)
 *   - Memoized projection / sensitivity / break-even / after-tax / BRRRR-timeline
 *   - Debounced streaming AI header verdict
 */
export interface AnalyzerStateArgs extends AnalyzerStateOptions {
  /** The saved row's `market_context`. Restored, never refetched — §4.4. */
  initialMarketContext?: MarketContext | null;
}

export function useAnalyzerState({
  isPro,
  initialAddress = "",
  paramAddress,
  paramZip,
  initialState,
  initialMarketContext,
}: AnalyzerStateArgs) {
  const isHydrated = Boolean(initialState);
  // A saved deal (initialState) overrides every default below to resume in
  // place — see resolveInitialAnalyzerState for the empty-analyzer defaults.
  const initial = resolveInitialAnalyzerState(initialState, initialAddress);
  const analyzer = useAnalyzer(initial.input);

  const [address, setAddress] = useState(initial.address);
  // Postcode of the suggestion the user picked from autocomplete. Mapbox hands
  // it to us as structured data, so it beats parsing the display string — and
  // it is the only market signal free-tier users get, since they never receive
  // a RentCast lookup. Cleared the moment the user edits the field by hand,
  // otherwise the previous property's ZIP would linger.
  const [selectedZip, setSelectedZip] = useState<string | null>(
    initial.selectedZip,
  );
  const changeAddress = (next: string) => {
    setAddress(next);
    setSelectedZip(null);
  };
  const [arvLocal, setArvLocal] = useState<number>(initial.arvLocal);
  const [rehabBudget, setRehabBudget] = useState<number>(initial.rehabBudget);
  const [propertyType, setPropertyType] = useState<"sfh" | "mf">(
    initial.propertyType,
  );
  const [unitCount, setUnitCount] = useState<number | null>(initial.unitCount);
  const [assumptions, setAssumptionsState] = useState<AnalyzerAssumptions>(
    initial.assumptions,
  );
  const setAssumption = <K extends keyof AnalyzerAssumptions>(
    key: K,
    value: AnalyzerAssumptions[K],
  ) => setAssumptionsState((prev) => ({ ...prev, [key]: value }));

  const propertyClass = derivePropertyClass(propertyType, unitCount);
  const effectiveUnits = unitCount ?? 1;

  // Keep flip/BRRRR-relevant fields on analyzer.input in sync so useAnalyzer's
  // computeFlipMetrics + computeBrrrrScore receive the user's tuned values.
  const setAnalyzerInput = analyzer.setInput;
  const isCommercial = propertyClass === "commercial_mf";
  useEffect(() => {
    setAnalyzerInput((prev) => ({
      ...prev,
      arv: arvLocal > 0 ? arvLocal : undefined,
      rehabBudget,
      holdingMonths: assumptions.holdingMonths,
      sellingCostsPct: assumptions.sellingCostsPct,
      refinanceLTVPct: assumptions.refinanceLTVPct,
      propertyClass,
      unitCount: effectiveUnits,
      marketCapRatePct: isCommercial ? assumptions.marketCapRatePct : undefined,
      targetDSCR: isCommercial ? assumptions.targetDSCR : undefined,
      capexReserveAnnualPerUnit: isCommercial
        ? assumptions.capexReserveAnnualPerUnit
        : undefined,
      financing: {
        ...prev.financing,
        amortizationYears: isCommercial
          ? assumptions.amortizationYears
          : undefined,
      },
    }));
  }, [
    arvLocal,
    rehabBudget,
    assumptions,
    propertyClass,
    isCommercial,
    effectiveUnits,
    setAnalyzerInput,
  ]);

  const propertyLookup = usePropertyLookup();
  const rentcastData =
    propertyLookup.data && "avm" in propertyLookup.data
      ? (propertyLookup.data as PropertyLookupResult)
      : null;
  const quotaExceeded = Boolean(
    propertyLookup.data && "quotaExceeded" in propertyLookup.data,
  );

  const [provenance, setProvenance] = useState<ProvenanceMap>(
    initial.provenance,
  );
  const prefill = useAnalyzerPrefill();

  const applyPrefillBundle = (
    bundle: Parameters<typeof buildProvenanceFromBundle>[0],
  ) => {
    setProvenance(buildProvenanceFromBundle(bundle, analyzer.setInput));
  };

  // The "Fetch property" button, deep-links (?address=), and page refresh all
  // populate rentcastData via propertyLookup. Prefill the form fields from the
  // parcel here so every one of those paths fills price/rent/tax/insurance/HOA
  // (the autocomplete dropdown fills the same fields via applyPrefillBundle).
  const lastSyncedRef = useRef<PropertyLookupResult | null>(null);
  useEffect(() => {
    if (!rentcastData || rentcastData === lastSyncedRef.current) return;
    lastSyncedRef.current = rentcastData;
    if (rentcastData.avm?.value && arvLocal === 0) {
      setArvLocal(Math.round(rentcastData.avm.value * 1.15));
    }
    setAnalyzerInput((prev) => mergeRentcastIntoInput(rentcastData, prev));
  }, [rentcastData, arvLocal, setAnalyzerInput]);

  // Auto-fetch on first render when address arrived via ?address= query param,
  // saving the user a click in the common deep-link flow — but never for a
  // hydrated saved deal (see shouldAutoFetchProperty). Note: `mutate` from
  // useMutation is stable, so we only depend on the trigger conditions.
  const autoFetchedRef = useRef(false);
  const mutate = propertyLookup.mutate;
  useEffect(() => {
    if (
      !shouldAutoFetchProperty({
        isPro,
        address,
        paramAddress,
        alreadyFetched: autoFetchedRef.current,
        isHydrated,
      })
    )
      return;
    autoFetchedRef.current = true;
    mutate({ address: address.trim() });
  }, [isPro, address, paramAddress, mutate, isHydrated]);

  const { projection, sensitivity, afterTax, breakEven, brrrrTimeline } =
    useDerivedAnalytics(analyzer.input, assumptions, arvLocal, rehabBudget);

  // Market context geography — see resolveMarketZip for the priority order.
  // Server-side, MetricResolutionService handles county/state fallback if
  // a ZIP has no metric coverage.
  const zip = resolveMarketZip({
    paramZip,
    selectedZip,
    resolvedAddress: rentcastData?.resolved_address,
    typedAddress: address,
  });
  // Suppressed for a hydrated saved deal until the user asks — see
  // useMarketRefreshGate for why a page view must not refetch the market.
  const marketGate = useMarketRefreshGate(isHydrated);
  const marketContextQuery = useMarketContext({
    zip: zip ?? undefined,
    enabled: Boolean(zip) && marketGate.enabled,
  });
  const marketContext = pickMarketContext({
    restored: initialMarketContext ?? null,
    live: marketContextQuery.data,
    isLive: marketGate.enabled && !marketContextQuery.isLoading,
  });
  const { piqByGeo, isResolving: piqByGeoResolving } = usePiqByGeo(
    marketContext?.chain,
    { enabled: marketGate.enabled, restored: initialState?.piqByGeo ?? null },
  );

  const verdictPayload = useMemo(
    () => ({
      input: analyzer.input,
      result: analyzer.rental,
      rentcast: rentcastData ?? {},
      // Momentum word, not the backend's legacy quality grade — handing the
      // model an "F" for a 43 makes it write the score up as a bad market
      // rather than a cooling one. CLAUDE.md §9.
      piq: marketContext?.piq_score
        ? {
            score: marketContext.piq_score.value,
            label: getScoreLabel(marketContext.piq_score.value),
            marketHeat: marketContext.market_heat?.value,
          }
        : {},
    }),
    [analyzer.input, analyzer.rental, rentcastData, marketContext],
  );
  const { text: aiVerdict, isStreaming } = useAiHeaderVerdict(
    isPro ? verdictPayload : null,
  );

  return {
    analyzer,
    address,
    setAddress: changeAddress,
    selectedZip, // was internal-only; Task 11 needs it to build deal state
    isHydrated,
    marketCapturedAt: initialState?.marketCapturedAt ?? null,
    /** "Update market data" only — see useMarketRefreshGate. */
    requestMarketRefresh: marketGate.requestMarketRefresh,
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
    quotaExceeded,
    projection,
    sensitivity,
    afterTax,
    breakEven,
    brrrrTimeline,
    aiVerdict,
    isStreaming,
    marketContext,
    marketContextLoading: marketContextQuery.isLoading,
    piqByGeo,
    piqByGeoResolving,
    provenance,
    applyPrefillBundle,
    prefill,
    handleAddressSelect: async (s: AddressSuggestion) => {
      setAddress(s.full);
      setSelectedZip(s.postalCode ?? null);
      const bundle = await prefill.mutateAsync({
        zip: s.postalCode ?? undefined,
        address: isPro ? s.full : undefined,
      });
      if (bundle) applyPrefillBundle(bundle);
    },
  };
}
