/**
 * HERO CONTRAST FETCHER
 *
 * Powers the landing hero's "famous cooler vs. surprising leader" verdict. One
 * cached batch call over the curated recognizable-metro pool returns each
 * market's score, 3-month trend, and the raw demand drivers (days on market,
 * price-cut share, YoY value change) used to narrate each side.
 *
 *   cooler = the biggest 3-month faller (the cooldown story).
 *   riser  = the highest-scoring market (a genuinely-hot leader). NOT the biggest
 *            mover: when the market is broadly cooling the biggest positive mover
 *            is often a trivial +N that doesn't read as "hot".
 *
 * Cost: ~0 per visitor (ISR-cached). Auto-refreshes monthly. Returns null on any
 * failure so the hero falls back to static copy (never blocks the LCP element).
 */

import { fetchAPICached } from "./base";
import { FEATURED_METRO_POOL } from "./featured-pool";

export type HeroMarket = {
  cbsa: string;
  name: string;
  score: number;
  /** 3-month change in score; negative = cooling. */
  delta: number;
  direction: "up" | "down";
  confidenceLevel: string;
  /** Demand drivers for the narrative (null when unavailable). */
  dom: number | null; // median days on market
  priceCutPct: number | null; // % of listings cutting price
  valueYoyPct: number | null; // home-value % change YoY
  /**
   * AI-written, future-framed ad copy for this market (DeepSeek, generated
   * server-side and cached per market+score-date — never per visitor). Undefined
   * when unavailable, in which case the hero uses a deterministic fallback.
   */
  narrative?: string | null;
};

export type PoolRow = HeroMarket & { asOf: string };

export type HeroContrast = {
  cooler: HeroMarket;
  riser: HeroMarket;
  /** Effective score date, for the required "as of" attribution. */
  asOf: string;
};

const toMarket = (r: PoolRow): HeroMarket => ({
  cbsa: r.cbsa,
  name: r.name,
  score: r.score,
  delta: r.delta,
  direction: r.direction,
  confidenceLevel: r.confidenceLevel,
  dom: r.dom,
  priceCutPct: r.priceCutPct,
  valueYoyPct: r.valueYoyPct,
  narrative: r.narrative ?? null,
});

/**
 * cooler = biggest faller; riser = highest score. Ties break by score then
 * cbsa (deterministic). Requires ≥2 valid rows; always two distinct markets.
 */
export function selectContrast(rows: PoolRow[]): HeroContrast | null {
  if (rows.length < 2) return null;
  const byFall = [...rows].sort(
    (a, b) =>
      a.delta - b.delta || a.score - b.score || a.cbsa.localeCompare(b.cbsa),
  );
  const byScore = [...rows].sort(
    (a, b) =>
      b.score - a.score || b.delta - a.delta || a.cbsa.localeCompare(b.cbsa),
  );
  const cooler = byFall[0];
  const riser = byScore[0].cbsa === cooler.cbsa ? byScore[1] : byScore[0];
  if (!riser || riser.cbsa === cooler.cbsa) return null;
  return {
    cooler: toMarket(cooler),
    riser: toMarket(riser),
    asOf: cooler.asOf,
  };
}

type BatchScoreRow = {
  location_id?: string;
  location_name?: string;
  score_date?: string;
  error?: string;
  z_scores?: {
    median_days_on_market?: number;
    price_reduced_share?: number;
    zhvi_yoy?: number;
  };
  scores?: {
    propertyiq?: {
      score?: number;
      trend_change?: number;
      confidence_level?: string;
      confidence?: { level?: string } | number;
      history?: { data?: { date: string; score: number }[] };
    };
  };
};

export async function fetchHeroContrast(): Promise<HeroContrast | null> {
  try {
    const ids = FEATURED_METRO_POOL.map((m) => m.cbsa).join(",");
    const json = await fetchAPICached<{ scores?: BatchScoreRow[] }>(
      "/api/scores/batch/metro",
      { ids, historyMonths: 3 },
      { revalidate: 21600 }, // 6h, matches the backend Cache-Control
    );

    const nameByCbsa = new Map(
      FEATURED_METRO_POOL.map((m) => [m.cbsa, m.name]),
    );
    const rows: PoolRow[] = [];

    for (const s of json?.scores ?? []) {
      if (!s || s.error || !s.location_id) continue;
      const piq = s.scores?.propertyiq;
      if (!piq || typeof piq.score !== "number") continue;

      const hist = piq.history?.data;
      const delta =
        typeof piq.trend_change === "number"
          ? piq.trend_change
          : hist && hist.length >= 2
            ? hist[0].score - hist[Math.min(3, hist.length - 1)].score
            : null;
      if (delta == null) continue;

      const z = s.z_scores;
      const pctFrom = (v: number | undefined, dp = 0): number | null =>
        typeof v === "number"
          ? Math.round(v * 100 * 10 ** dp) / 10 ** dp
          : null;

      rows.push({
        cbsa: s.location_id,
        name: nameByCbsa.get(s.location_id) ?? s.location_name ?? s.location_id,
        score: piq.score,
        delta,
        direction: delta >= 0 ? "up" : "down",
        confidenceLevel:
          piq.confidence_level ??
          (typeof piq.confidence === "object"
            ? piq.confidence?.level
            : undefined) ??
          "A",
        dom:
          typeof z?.median_days_on_market === "number"
            ? Math.round(z.median_days_on_market)
            : null,
        priceCutPct: pctFrom(z?.price_reduced_share, 0),
        valueYoyPct: pctFrom(z?.zhvi_yoy, 1),
        asOf: s.score_date ?? hist?.[0]?.date ?? "",
      });
    }

    return selectContrast(rows);
  } catch {
    return null;
  }
}
