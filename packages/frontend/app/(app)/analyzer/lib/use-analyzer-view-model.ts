import { useThresholds } from "@/lib/data";
import { buildCompsViewProps } from "./comps-view-props";
import { deriveCashflowSummary } from "./cashflow-summary";
import { deriveVerdict, type VerdictInputs } from "./format-helpers";
import { toEngineStrategy } from "./use-grading-result";
import {
  detectActivePreset,
  type AnyStrategyThresholds,
} from "../components/CustomizeThresholdsDrawer/preset-helpers";
import type { Strategy } from "./strategy-tile-mappers";
import type { AnalysisMode } from "../components/InputPanel/StrategyControls";

/**
 * "Graded against X criteria" must reflect the user's SAVED rubric, not a
 * hardcoded preset name. GET falls back to the Balanced preset when the
 * account has no saved row, so detectActivePreset resolves it correctly;
 * anything off the preset grid reads as Custom.
 */
export function resolvePresetLabel(
  savedThresholds: unknown,
  activePreset: string | null,
): string {
  if (!savedThresholds) return "Balanced";
  if (!activePreset) return "Custom";
  return activePreset.charAt(0).toUpperCase() + activePreset.slice(1);
}

/**
 * The two whole-deal reads the page gates on: whether there is enough input
 * to grade at all, and the headline verdict.
 *
 * Deliberately a plain function rather than part of `useAnalyzerViewModel`:
 * `hasGradableInput` feeds `useSelectedGoal`, whose `bestPlay` the view model
 * then consumes, so this has to resolve first.
 */
export function deriveDealReadout(
  input: { price?: number | null; rentMonthly?: number | null },
  rental: Omit<VerdictInputs, "piqScore">,
  piqScore: number | null,
) {
  return {
    hasGradableInput:
      (input.price ?? 0) > 0 &&
      ((input.rentMonthly ?? 0) > 0 || rental.capRatePct != null),
    verdict: deriveVerdict({
      capRatePct: rental.capRatePct,
      dscr: rental.dscr,
      cashflowMonthly: rental.cashflowMonthly,
      piqScore,
    }),
  };
}

export function resolveDisplayAddress(
  resolvedAddress: string | undefined,
  typedAddress: string,
): string | null {
  return resolvedAddress ?? (typedAddress.trim() || null);
}

type CompsSource = Parameters<typeof buildCompsViewProps>[0];

/**
 * Which parcel payload the comps panel renders from.
 *
 * An explicit "Fetch property" press wins — it is the newest data and the user
 * asked for it. Otherwise fall back to the parcel the address-prefill call
 * already retrieved: the backend made that same paid RentCast call, so the
 * comps are sitting there either way.
 *
 * Without the fallback, choosing an address from autocomplete filled
 * price/rent/tax/HOA with RentCast provenance while the comps panel below still
 * read "fetch property data to populate" — comps we had already been billed for.
 *
 * STALENESS: `prefillParcel` comes from a React Query mutation, which keeps its
 * `data` until the next SUCCESS — not cleared when a new call starts, nor on
 * error. Reading it here would therefore render the PREVIOUS address's comps
 * and subject pin under the newly selected address, and keep them indefinitely
 * if that request throws. `handleAddressSelect` calls `prefill.reset()` before
 * each lookup so the gap shows an honest empty state instead. Don't remove that
 * reset without adding an identity check here — silently attributing one
 * property's comps to another is worse than showing none.
 */
export function pickCompsSource(
  rentcastData: CompsSource,
  prefillParcel?: CompsSource,
): CompsSource {
  return rentcastData ?? prefillParcel ?? null;
}

export interface AnalyzerViewModelArgs {
  analysisMode: AnalysisMode;
  bestPlay: Strategy;
  focusedStrategy: Strategy;
  resolvedAddress: string | undefined;
  address: string;
  rentcastData: Parameters<typeof buildCompsViewProps>[0];
  /**
   * Parcel payload carried back by the address-prefill call. Used ONLY as the
   * comps fallback below — deliberately not merged into `rentcastData`, whose
   * identity drives the input-sync effect and the RentCast status banners.
   */
  prefillParcel?: Parameters<typeof buildCompsViewProps>[0];
  price: number;
  input: Parameters<typeof deriveCashflowSummary>[0];
  rental: Parameters<typeof deriveCashflowSummary>[1];
  lookupError: { message?: string } | null;
}

export function useAnalyzerViewModel(args: AnalyzerViewModelArgs) {
  const activeStrategy: Strategy =
    args.analysisMode === "compare" ? args.bestPlay : args.focusedStrategy;
  const engineStrategy = toEngineStrategy(activeStrategy) ?? "BUY_AND_HOLD";
  // Owned here (rather than passed in) so AnalyzerClient doesn't need to
  // pre-derive engineStrategy just to fetch the thresholds this hook already
  // needs for presetLabel.
  const savedThresholdsQ = useThresholds(engineStrategy);
  const savedThresholds = savedThresholdsQ.data as
    | AnyStrategyThresholds
    | undefined;
  const activePreset = detectActivePreset(
    engineStrategy,
    savedThresholds ?? null,
  );

  return {
    activeStrategy,
    engineStrategy,
    // Surfaced (not just consumed for presetLabel) so the saved deal state
    // can persist a custom rubric — see use-current-deal-state.
    savedThresholds,
    presetLabel: resolvePresetLabel(savedThresholds, activePreset),
    displayAddress: resolveDisplayAddress(args.resolvedAddress, args.address),
    compsView: buildCompsViewProps(
      pickCompsSource(args.rentcastData, args.prefillParcel),
      args.price,
    ),
    cashflow: deriveCashflowSummary(args.input, args.rental),
    lookupErrorMsg: args.lookupError
      ? String(args.lookupError.message ?? args.lookupError)
      : null,
  };
}
