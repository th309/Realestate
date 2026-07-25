/**
 * Resolves the run wizard's initial step/format/market from `?format=&market=`
 * query params (the "Make this video" handoff from the Video Scripts page).
 * Pure so the routing rules are unit-testable. Invalid/absent format lands on
 * the format step unselected; ranking formats can't carry a single market, so
 * they route to ranking-params regardless of a market param.
 */
import { FORMAT_META } from "../../lib/format-previews";

export type WizardStep =
  | "format"
  | "market"
  | "confirm"
  | "ranking-params"
  | "ranking-preview";

const RANKING_FORMATS = new Set(["top_10_ranking", "bottom_10_ranking"]);

function isValidFormat(format: string | null | undefined): format is string {
  return (
    format != null && Object.prototype.hasOwnProperty.call(FORMAT_META, format)
  );
}

export function resolvePrefill(input: {
  format?: string | null;
  market?: string | null;
}): { format: string; market: string; step: WizardStep } {
  if (!isValidFormat(input.format)) {
    return { format: "", market: "", step: "format" };
  }
  if (RANKING_FORMATS.has(input.format)) {
    return { format: input.format, market: "", step: "ranking-params" };
  }
  const market = input.market?.trim() ?? "";
  return {
    format: input.format,
    market,
    step: market ? "confirm" : "market",
  };
}
