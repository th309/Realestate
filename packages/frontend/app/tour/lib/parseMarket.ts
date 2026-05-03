import type { MarketRef } from "@/lib/data";

/**
 * Aliases for geoLevel prefixes that show up in URL params but need to be
 * normalized to the canonical data-layer geoLevel before being handed off.
 */
export const GEO_LEVEL_ALIAS: Record<string, MarketRef["geoLevel"]> = {
  cbsa: "metro", // CBSA codes are metros at the data layer
};

export const VALID_GEO_LEVELS = new Set<MarketRef["geoLevel"]>([
  "metro",
  "county",
  "city",
  "zip",
]);

/**
 * Parses a "<geoLevel>-<geoId>" URL param (e.g. "metro-39580" or
 * "cbsa-39580") into a MarketRef. Returns null if the input is missing,
 * malformed, or the geoLevel does not normalize to a valid data-layer level.
 */
export function parseMarket(raw: string | null): MarketRef | null {
  if (!raw) return null;
  const m = raw.match(/^([a-z]+)-(.+)$/);
  if (!m) return null;
  const rawLevel = m[1];
  const normalized = (GEO_LEVEL_ALIAS[rawLevel] ?? rawLevel) as string;
  if (!VALID_GEO_LEVELS.has(normalized as MarketRef["geoLevel"])) return null;
  return {
    geoLevel: normalized as MarketRef["geoLevel"],
    geoId: m[2],
    name: "",
  };
}
