/**
 * Resolves the run wizard's initial step/format from `?format=&market=` query
 * params (the "Make this video" handoff from the Video Scripts page). Pure so
 * the routing rules are unit-testable.
 *
 * A prefilled market is a SEED, never a verified selection: it's handed to the
 * market step to auto-search and only becomes the run's `marketQuery` once
 * `resolveMarket` returns a match the step can pick — the same validation every
 * other path goes through. So we never jump straight to confirm with an
 * unverified string. Invalid/absent format lands on the format step; ranking
 * formats can't carry a single market, so they route to ranking-params.
 */
import { isValidRunFormat } from "../../lib/format-previews";

export type WizardStep =
  | "format"
  | "market"
  | "confirm"
  | "ranking-params"
  | "ranking-preview";

const RANKING_FORMATS = new Set(["top_10_ranking", "bottom_10_ranking"]);

export function resolvePrefill(input: {
  format?: string | null;
  market?: string | null;
}): { format: string; marketSeed: string; step: WizardStep } {
  if (!isValidRunFormat(input.format)) {
    return { format: "", marketSeed: "", step: "format" };
  }
  if (RANKING_FORMATS.has(input.format)) {
    return { format: input.format, marketSeed: "", step: "ranking-params" };
  }
  return {
    format: input.format,
    marketSeed: input.market?.trim() ?? "",
    step: "market",
  };
}
