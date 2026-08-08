/**
 * Builders for the saved + shared analyzer render paths.
 *
 * The /analyzer/saved/[id] and /shared/analysis/[token] routes display a
 * historical snapshot of an analysis — not a live recompute. The fields
 * actually stored are `rental: RentalResult`, optional `flip: FlipResult`,
 * optional `brrrr: BrrrrResult`, plus `market_context: MarketContext`.
 *
 * Projection / sensitivity / break-even / after-tax aren't persisted, so the
 * snapshot views don't get those sections — they only render the KPI strip,
 * strategy grid, and market context. This helper translates the saved DTO's
 * `market_context` shape into the props expected by `MarketContextSection`.
 */

import type { MarketContext } from "@/lib/data";
import type { RichResultSnapshot } from "./analyzer-snapshot-types";

export interface MarketContextSectionInputs {
  /** Pre-baked snapshot blob from saved/shared analyses doesn't include the
   *  geography parent chain — pass null so the section renders pills-free. */
  chain: null;
  initialGeoLevel: "zip" | "county" | "metro" | "state" | null;
  fallbackPiq: number | null;
  fallbackHomeValue: number | null;
  fallbackHomeValueYoy: number | null;
  fallbackRentIndex: number | null;
  fallbackMarketHeat: number | null;
  fallbackNetMigration: number | null;
  /** Persisted AI prose for this section — saved/shared routes never fire a
   *  live AI fetch, so this is the only text the section ever shows. */
  aiText: string | null;
  /** Always false: the snapshot is already resolved, there is nothing to load. */
  aiIsLoading: boolean;
}

/**
 * Map the persisted `market_context` blob (matching `MarketContext`) to the
 * fallback props expected by `MarketContextSection`. Saved analyses are
 * snapshot data with no live geography — pills are suppressed (chain=null)
 * and the section paints the snapshot values without firing trend hooks.
 *
 * `ai` is the persisted `aiNarratives` blob (see `RichResultSnapshot`);
 * mirrors the `market_context ?? comps` preference used by the public share
 * view (`ReadonlyAnalyzerView`) so both read paths render identical prose.
 */
export function extractMarketContextProps(
  mc: MarketContext | Record<string, unknown> | null | undefined,
  ai?: RichResultSnapshot["aiNarratives"],
): MarketContextSectionInputs {
  const ctx = (mc ?? {}) as Partial<MarketContext>;
  const narratives = (ai ?? {}) as NonNullable<
    RichResultSnapshot["aiNarratives"]
  >;
  return {
    chain: null,
    initialGeoLevel: ctx.geo_level ?? null,
    fallbackPiq: ctx.piq_score?.value ?? null,
    fallbackHomeValue: ctx.home_value?.value ?? null,
    fallbackHomeValueYoy: ctx.home_value_yoy?.value ?? null,
    fallbackRentIndex: ctx.rent_index?.value ?? null,
    fallbackMarketHeat: ctx.market_heat?.value ?? null,
    fallbackNetMigration: ctx.net_migration?.value ?? null,
    aiText: narratives.market_context ?? narratives.comps ?? null,
    aiIsLoading: false,
  };
}
