"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { buildDealState } from "./build-deal-state";
import type { DealStateV2 } from "./deal-state-types";
import { useDealAutosave, type SaveStatus } from "./use-deal-autosave";
import type { useAnalyzerState } from "./use-analyzer-state";
import type { InvestorGoal } from "./goal-types";
import type { AnalysisMode } from "../components/InputPanel/StrategyControls";
import type { AnyStrategyThresholds } from "../components/CustomizeThresholdsDrawer/preset-helpers";

/** The slice of `useAnalyzerState()` that becomes persisted deal state. */
type AnalyzerStateSlice = Pick<
  ReturnType<typeof useAnalyzerState>,
  | "analyzer"
  | "address"
  | "selectedZip"
  | "arvLocal"
  | "rehabBudget"
  | "propertyType"
  | "unitCount"
  | "assumptions"
  | "provenance"
  | "rentcastData"
  | "piqByGeo"
  | "marketCapturedAt"
>;

export interface UseCurrentDealStateArgs {
  state: AnalyzerStateSlice;
  /** The saved deal being resumed, if any. Undefined for a fresh analysis. */
  initialState?: DealStateV2;
  /** Row id once one exists — autosave stays off until then. */
  dealId: string | null;
  /** Autosave is a Pro capability; the PATCH endpoint requires it. */
  isPro: boolean;
  analysisMode: AnalysisMode;
  /** Compare-mode goal ONLY. Recorded as an audit trail, never restored — spec §4.6. */
  activeGoal: InvestorGoal | null;
  /** Present only when the user is off the preset grid. */
  thresholds?: AnyStrategyThresholds;
  notes: string;
  shareNotes: boolean;
}

export interface CurrentDealState {
  dealState: DealStateV2;
  saveStatus: SaveStatus;
  retrySave: () => void;
  /** Live staleness clock — the saved value until an explicit refresh. */
  marketCapturedAt: string;
  refreshMarketData: () => void;
  isRefreshingMarket: boolean;
}

/**
 * Assembles the current `DealStateV2`, owns the market-capture clock, and
 * drives autosave off the result.
 *
 * Lives outside `AnalyzerClient` for two reasons. The obvious one is the
 * 400-line component cap (CLAUDE.md §1.3). The load-bearing one is
 * MEMOIZATION: `useDealAutosave` re-arms its debounce whenever the state
 * object's identity changes, so rebuilding the object on every render would
 * make its own `setStatus("saving"/"saved")` re-render schedule the next
 * save — an autosave loop writing every couple of seconds forever. The
 * `useMemo` below keys on the underlying values so identity changes only
 * when the deal actually changes. `piqByGeo` is spread into primitives for
 * the same reason: `usePiqByGeo` returns a fresh object each render.
 *
 * `marketCapturedAt` is NOT bumped by autosave (spec §4.5) — it is the
 * clock `StaleDealNotice` reads, and an edit is not a market refresh. Only
 * "Update market data" moves it.
 */
export function useCurrentDealState({
  state,
  initialState,
  dealId,
  isPro,
  analysisMode,
  activeGoal,
  thresholds,
  notes,
  shareNotes,
}: UseCurrentDealStateArgs): CurrentDealState {
  const queryClient = useQueryClient();
  const [marketCapturedAt, setMarketCapturedAt] = useState<string>(
    // A fresh analysis captures the market as of this page load; a resumed
    // deal keeps the timestamp it was saved with.
    () => state.marketCapturedAt ?? new Date().toISOString(),
  );
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);

  const {
    analyzer,
    address,
    selectedZip,
    arvLocal,
    rehabBudget,
    propertyType,
    unitCount,
    assumptions,
    provenance,
    rentcastData,
    piqByGeo,
  } = state;
  const { input } = analyzer;
  const { zip: piqZip, county: piqCounty, metro: piqMetro } = piqByGeo;
  const savedLabel = initialState?.label ?? null;
  const savedEcho = initialState?.rentcastEcho ?? null;

  const dealState = useMemo(
    () =>
      buildDealState({
        input,
        address,
        selectedZip: selectedZip ?? null,
        label: savedLabel,
        arvLocal,
        rehabBudget,
        propertyType,
        unitCount,
        assumptions,
        analysisMode,
        activeGoalAtSave: activeGoal,
        thresholds,
        provenance,
        // A live RentCast record wins; otherwise keep what was saved so a
        // reopened deal doesn't lose its parcel echo by not re-looking-up.
        rentcastEcho: rentcastData?.property_record
          ? {
              city: rentcastData.property_record.city,
              state: rentcastData.property_record.state,
              zip: rentcastData.property_record.zipCode,
              avmValue: rentcastData.avm?.value ?? null,
            }
          : savedEcho,
        piqByGeo: { zip: piqZip, county: piqCounty, metro: piqMetro },
        notes,
        shareNotes,
        marketCapturedAt,
      }),
    [
      input,
      address,
      selectedZip,
      savedLabel,
      arvLocal,
      rehabBudget,
      propertyType,
      unitCount,
      assumptions,
      analysisMode,
      activeGoal,
      thresholds,
      provenance,
      rentcastData,
      savedEcho,
      piqZip,
      piqCounty,
      piqMetro,
      notes,
      shareNotes,
      marketCapturedAt,
    ],
  );

  const autosave = useDealAutosave({
    dealId,
    state: dealState,
    enabled: isPro,
  });

  // Market context and the three per-geo PIQ reads share one query prefix
  // (see useMarketContext), so one invalidation refreshes the strip, the
  // section and the score chain together.
  const refreshMarketData = useCallback(() => {
    setIsRefreshingMarket(true);
    void queryClient
      .invalidateQueries({ queryKey: ["analyzer", "market-context"] })
      .then(() => setMarketCapturedAt(new Date().toISOString()))
      .finally(() => setIsRefreshingMarket(false));
  }, [queryClient]);

  return {
    dealState,
    saveStatus: autosave.status,
    retrySave: autosave.retry,
    marketCapturedAt,
    refreshMarketData,
    isRefreshingMarket,
  };
}
