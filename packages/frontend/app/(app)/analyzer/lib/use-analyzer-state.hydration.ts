/**
 * Hydration concern for use-analyzer-state.ts: resolving a saved deal's
 * DealStateV2 into concrete useState defaults, and gating the RentCast
 * auto-fetch so opening a saved deal never spends a paid lookup.
 * Extracted to keep the main hook under the 300-line hard limit (CLAUDE.md §1.3).
 */
import type { AnalyzerInputState } from "@/lib/analyzer/useAnalyzer";
import {
  DEFAULT_ASSUMPTIONS,
  type AnalyzerAssumptions,
} from "./analyzer-assumptions";
import type { ProvenanceMap } from "./use-analyzer-state.provenance";
import type { DealStateV2 } from "./deal-state-types";

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
