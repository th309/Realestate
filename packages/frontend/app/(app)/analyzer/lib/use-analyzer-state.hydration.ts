/**
 * Hydration concern for use-analyzer-state.ts: resolving a saved deal's
 * DealStateV2 into concrete useState defaults, and gating the outbound
 * fetches — RentCast and market context — so opening a saved deal is a pure
 * page view.
 * Extracted to keep the main hook under the 300-line hard limit (CLAUDE.md §1.3).
 */
import { useCallback, useState } from "react";
import type { AnalyzerInputState } from "@/lib/analyzer/useAnalyzer";
import {
  DEFAULT_ASSUMPTIONS,
  type AnalyzerAssumptions,
} from "./analyzer-assumptions";
import type { ProvenanceMap } from "./use-analyzer-state.provenance";
import type { DealStateV2 } from "./deal-state-types";
import type { MarketContext } from "@/lib/data/fetchers/analyzer";

// Analyzer waits for the user (or RentCast fetch) to supply numbers.
// Hardcoded defaults misled users into thinking the analyzer had already
// valued their property; null forces an explicit step.
const EMPTY_ANALYZER_INPUT: Partial<AnalyzerInputState> = {
  price: 0,
  rentMonthly: null,
  taxAnnual: null,
  insuranceAnnual: null,
};

export interface ResolvedAnalyzerState {
  input: Partial<AnalyzerInputState>;
  address: string;
  selectedZip: string | null;
  arvLocal: number;
  rehabBudget: number;
  propertyType: "sfh" | "mf";
  unitCount: number | null;
  assumptions: AnalyzerAssumptions;
  provenance: ProvenanceMap;
}

/**
 * Concrete useState defaults for `useAnalyzerState`. A saved deal
 * (`initialState`) overrides every field to resume in place; otherwise each
 * field falls back to the same empty-analyzer defaults as before.
 */
export function resolveInitialAnalyzerState(
  initialState: DealStateV2 | undefined,
  initialAddress: string,
): ResolvedAnalyzerState {
  return {
    input: initialState?.input ?? EMPTY_ANALYZER_INPUT,
    address: initialState?.address ?? initialAddress,
    selectedZip: initialState?.selectedZip ?? null,
    arvLocal: initialState?.arvLocal ?? 0,
    rehabBudget: initialState?.rehabBudget ?? 45_000,
    propertyType: initialState?.propertyType ?? "sfh",
    unitCount: initialState?.unitCount ?? 1,
    assumptions: initialState?.assumptions ?? DEFAULT_ASSUMPTIONS,
    provenance: initialState?.provenance ?? {},
  };
}

/**
 * Whether to fire the RentCast lookup automatically on mount.
 *
 * A hydrated saved deal must NOT auto-fetch: RentCast is a paid,
 * quota-limited third-party lookup, and opening a saved deal is a page view.
 * The saved parcel echo renders instead, and the existing "Fetch property"
 * button remains the user's explicit refresh.
 */
export function shouldAutoFetchProperty(args: {
  isPro: boolean;
  address: string;
  paramAddress?: string;
  alreadyFetched: boolean;
  isHydrated: boolean;
}): boolean {
  if (args.alreadyFetched || args.isHydrated) return false;
  return (
    args.isPro && args.address.trim().length > 5 && Boolean(args.paramAddress)
  );
}

export interface MarketRefreshGate {
  /** Feeds `enabled` on every market-context query. */
  enabled: boolean;
  /** Turns the live queries on. Called ONLY by "Update market data". */
  requestMarketRefresh: () => void;
}

/**
 * The market-data equivalent of `shouldAutoFetchProperty`, and for the same
 * reason: a hydrated saved deal must not refetch what it restored.
 *
 * Spec §4.4 restores market context and per-geo PIQ rather than refetching
 * them, and the product decision behind it is blunter still — "just save, no
 * auto update". Left ungated, the queries resolve with fresh values a second
 * after open, the deal-state content changes, and autosave faithfully writes
 * a row the user only LOOKED at. It also desynchronizes the stored scores
 * from `marketCapturedAt` (which moves only on an explicit refresh), so a
 * deal can warn "74 days old" while its stored scores are already current.
 *
 * The flag is one-way: once the user refreshes, this deal follows the live
 * market for the rest of the session.
 */
export function useMarketRefreshGate(isHydrated: boolean): MarketRefreshGate {
  const [requested, setRequested] = useState(false);
  const requestMarketRefresh = useCallback(() => setRequested(true), []);
  return { enabled: !isHydrated || requested, requestMarketRefresh };
}

/**
 * Which market context to render: the restored one while the live query is
 * suppressed or still in flight, the live one once it answers.
 *
 * Deliberately not `live ?? restored` — `useMarketContext` returns `null` as
 * a legitimate loaded value (unknown geography, 4xx), and collapsing that
 * into the restored context would keep showing saved data the refresh just
 * proved absent.
 */
export function pickMarketContext(args: {
  restored: MarketContext | null;
  live: MarketContext | null | undefined;
  /** True once the live query owns the answer. */
  isLive: boolean;
}): MarketContext | null | undefined {
  return args.restored && !args.isLive ? args.restored : args.live;
}
