"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeProjection,
  computeSensitivity,
  computeAfterTax,
  computeBrrrrTimeline,
  computeBreakEven,
} from "@propertyiq/analyzer-core";
import { useAnalyzer } from "@/lib/analyzer/useAnalyzer";
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
  extractZip,
  type AnalyzerStateOptions,
  type FieldProvenance,
  type ProvenanceMap,
  isDivergent,
} from "./use-analyzer-state.provenance";

export type { FieldProvenance, ProvenanceMap };
export { isDivergent };
export type { AnalyzerAssumptions };
export { DEFAULT_ASSUMPTIONS };

/**
 * Combines all the analyzer state + side effects into one consumable hook so
 * `AnalyzerClient.tsx` stays a thin coordinator.
 *
 * Side effects encapsulated here:
 *   - RentCast fetch (mutation) + sync result to input fields once per fetch
 *   - Auto-fetch on first render when address arrives via ?address= param
 *   - Memoized projection / sensitivity / break-even / after-tax / BRRRR-timeline
 *   - Debounced streaming AI header verdict
 */
export function useAnalyzerState({
  isPro,
  initialAddress = "",
  paramAddress,
  paramZip,
}: AnalyzerStateOptions) {
  // Empty initial state — analyzer waits for the user (or RentCast fetch) to
  // supply numbers. Hardcoded defaults misled users into thinking the analyzer
  // had already valued their property; null forces an explicit step.
  const analyzer = useAnalyzer({
    price: 0,
    rentMonthly: null,
    taxAnnual: null,
    insuranceAnnual: null,
  });

  const [address, setAddress] = useState(initialAddress);
  const [arvLocal, setArvLocal] = useState<number>(0);
  const [rehabBudget, setRehabBudget] = useState<number>(45_000);
  const [propertyType, setPropertyType] = useState<"sfh" | "mf">("sfh");
  const [unitCount, setUnitCount] = useState<number | null>(1);
  const [assumptions, setAssumptionsState] =
    useState<AnalyzerAssumptions>(DEFAULT_ASSUMPTIONS);
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

  const [provenance, setProvenance] = useState<ProvenanceMap>({});
  const prefill = useAnalyzerPrefill();

  const applyPrefillBundle = (
    bundle: Parameters<typeof buildProvenanceFromBundle>[0],
  ) => {
    setProvenance(
      buildProvenanceFromBundle(bundle, analyzer.setInput, setAssumptionsState),
    );
  };

  // RentCast still seeds ARV for flip/BRRRR; field prefill now flows through
  // applyPrefillBundle, so price/rent are no longer set here.
  const lastSyncedRef = useRef<PropertyLookupResult | null>(null);
  useEffect(() => {
    if (!rentcastData || rentcastData === lastSyncedRef.current) return;
    lastSyncedRef.current = rentcastData;
    if (rentcastData.avm?.value && arvLocal === 0) {
      setArvLocal(Math.round(rentcastData.avm.value * 1.15));
    }
  }, [rentcastData, arvLocal]);

  // Auto-fetch on first render when address arrived via ?address= query param,
  // saving the user a click in the common deep-link flow. Note: `mutate` from
  // useMutation is stable, so we only depend on the trigger conditions.
  const autoFetchedRef = useRef(false);
  const mutate = propertyLookup.mutate;
  useEffect(() => {
    const trimmed = address.trim();
    const shouldFetch =
      !autoFetchedRef.current &&
      isPro &&
      trimmed.length > 5 &&
      Boolean(paramAddress);
    if (shouldFetch) {
      autoFetchedRef.current = true;
      mutate({ address: trimmed });
    }
  }, [isPro, address, paramAddress, mutate]);

  const projection = useMemo(
    () =>
      computeProjection(analyzer.input, {
        appreciationPct: assumptions.appreciationPct,
        rentGrowthPct: assumptions.rentGrowthPct,
        expenseGrowthPct: assumptions.expenseGrowthPct,
      }),
    [
      analyzer.input,
      assumptions.appreciationPct,
      assumptions.rentGrowthPct,
      assumptions.expenseGrowthPct,
    ],
  );
  const sensitivity = useMemo(
    () => computeSensitivity(analyzer.input),
    [analyzer.input],
  );
  const afterTax = useMemo(
    () =>
      computeAfterTax(analyzer.input, {
        marginalTaxRate: assumptions.marginalTaxRate,
        landValuePct: assumptions.landValuePct,
      }),
    [analyzer.input, assumptions.marginalTaxRate, assumptions.landValuePct],
  );
  const breakEven = useMemo(
    () => computeBreakEven(analyzer.input),
    [analyzer.input],
  );
  const brrrrTimeline = useMemo(
    () =>
      computeBrrrrTimeline(
        { ...analyzer.input, arv: arvLocal, rehabBudget },
        {
          seasoningMonths: assumptions.seasoningMonths,
          rehabMonths: assumptions.rehabMonths,
          leaseMonths: assumptions.leaseMonths,
        },
      ),
    [
      analyzer.input,
      arvLocal,
      rehabBudget,
      assumptions.seasoningMonths,
      assumptions.rehabMonths,
      assumptions.leaseMonths,
    ],
  );

  // Market context geography priority:
  //   1. ?zip= URL param (explicit, deep-link)
  //   2. ZIP extracted from RentCast's resolved_address (canonical)
  //   3. ZIP extracted from the user-typed address (works without RentCast,
  //      so free-tier users still get market data)
  // Server-side, MetricResolutionService handles county/state fallback if
  // a ZIP has no metric coverage.
  const zip =
    (paramZip && /^\d{5}$/.test(paramZip) ? paramZip : null) ??
    extractZip(rentcastData?.resolved_address) ??
    extractZip(address);
  const marketContextQuery = useMarketContext({
    zip: zip ?? undefined,
    enabled: Boolean(zip),
  });
  const marketContext = marketContextQuery.data;
  const { piqByGeo } = usePiqByGeo(marketContext?.chain);

  const verdictPayload = useMemo(
    () => ({
      input: analyzer.input,
      result: analyzer.rental,
      rentcast: rentcastData ?? {},
      piq: marketContext?.piq_score
        ? {
            score: marketContext.piq_score.value,
            label: marketContext.piq_score.label,
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
    provenance,
    applyPrefillBundle,
    prefill,
    handleAddressSelect: async (s: AddressSuggestion) => {
      setAddress(s.full);
      const bundle = await prefill.mutateAsync({
        zip: s.postalCode ?? undefined,
        address: isPro ? s.full : undefined,
      });
      if (bundle) applyPrefillBundle(bundle);
    },
  };
}
