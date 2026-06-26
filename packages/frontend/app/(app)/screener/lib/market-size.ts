import type { ScreenerGeoLevel } from "@/lib/data";

// Market-size floor (population) for the DEFAULT de-noised screener + movers view
// (beta backlog #26/#29). Keeps micro-markets from dominating the flagship surface
// without touching any PropertyIQ score — it only filters which rows show by default.
// metro/county use their own population; ZIP uses its parent county's (the snapshot
// stores the inherited value). User-clearable via the MarketSizeToggle.
export const MARKET_SIZE_FLOOR: Record<ScreenerGeoLevel, number> = {
  metro: 150_000,
  county: 75_000,
  zip: 75_000,
};

/** Resolve the population floor for a geo level, or undefined when the user opts in
 * to all market sizes. */
export function populationFloorFor(
  geo: ScreenerGeoLevel,
  hideSmallMarkets: boolean,
): number | undefined {
  return hideSmallMarkets ? MARKET_SIZE_FLOOR[geo] : undefined;
}
