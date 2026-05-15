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
  type PropertyLookupResult,
} from "@/lib/data";

interface AnalyzerStateOptions {
  isPro: boolean;
  initialAddress?: string;
  paramAddress?: string;
}

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

  const propertyLookup = usePropertyLookup();
  const rentcastData =
    propertyLookup.data && "avm" in propertyLookup.data
      ? (propertyLookup.data as PropertyLookupResult)
      : null;
  const quotaExceeded = Boolean(
    propertyLookup.data && "quotaExceeded" in propertyLookup.data,
  );

  // Sync RentCast result → input fields once per fresh fetch. The mutation
  // `data` ref changes only when a new request resolves, so user edits made
  // afterwards are not clobbered by a re-render.
  const lastSyncedRef = useRef<PropertyLookupResult | null>(null);
  useEffect(() => {
    if (!rentcastData || rentcastData === lastSyncedRef.current) return;
    lastSyncedRef.current = rentcastData;
    analyzer.setInput((prev) => ({
      ...prev,
      price: rentcastData.avm?.value ?? prev.price,
      rentMonthly: rentcastData.rent?.value ?? prev.rentMonthly,
    }));
    if (rentcastData.avm?.value && arvLocal === 0) {
      // Default ARV to AVM × 1.15 as a starting point for flip/BRRRR analysis
      setArvLocal(Math.round(rentcastData.avm.value * 1.15));
    }
  }, [rentcastData, analyzer, arvLocal]);

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
    if (process.env.NODE_ENV !== "production") {
       
      console.log("[analyzer] auto-fetch check", {
        isPro,
        addressLength: trimmed.length,
        paramAddress,
        autoFetched: autoFetchedRef.current,
        shouldFetch,
      });
    }
    if (shouldFetch) {
      autoFetchedRef.current = true;
      mutate({ address: trimmed });
    }
  }, [isPro, address, paramAddress, mutate]);

  const projection = useMemo(
    () => computeProjection(analyzer.input),
    [analyzer.input],
  );
  const sensitivity = useMemo(
    () => computeSensitivity(analyzer.input),
    [analyzer.input],
  );
  const afterTax = useMemo(
    () => computeAfterTax(analyzer.input),
    [analyzer.input],
  );
  const breakEven = useMemo(
    () => computeBreakEven(analyzer.input),
    [analyzer.input],
  );
  const brrrrTimeline = useMemo(
    () =>
      computeBrrrrTimeline({
        ...analyzer.input,
        arv: arvLocal,
        rehabBudget: 45_000,
      }),
    [analyzer.input, arvLocal],
  );

  const verdictPayload = useMemo(
    () => ({
      input: analyzer.input,
      result: analyzer.rental,
      rentcast: rentcastData ?? {},
      piq: {},
    }),
    [analyzer.input, analyzer.rental, rentcastData],
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
  };
}
