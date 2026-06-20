/**
 * HERO CONTRAST FETCHER
 *
 * Powers the landing hero's dynamic "famous cooler vs. surprising riser"
 * verdict. One cached batch call over the curated recognizable-metro pool
 * (FEATURED_METRO_POOL) returns each market's current score + 3-month trend;
 * momentum selection picks the biggest faller (cooler) and biggest riser.
 *
 * Cost: ~0 per visitor (ISR-cached). Auto-refreshes each month as scores update
 * — no hardcoded numbers, no manual edits, no per-visit regeneration. Returns
 * null on any failure so the hero can fall back to static copy (never blocks
 * the LCP element on data).
 */

import { fetchAPICached } from "./base";
import { FEATURED_METRO_POOL } from "./featured-pool";

export type HeroMarket = {
  cbsa: string;
  name: string;
  score: number;
  /** 3-month change in score; negative = cooling, positive = heating up. */
  delta: number;
  direction: "up" | "down";
  confidenceLevel: string;
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
});

/**
 * Pure momentum selection. Cooler = biggest 3-month faller, riser = biggest
 * riser; ties break by absolute score then cbsa (deterministic). Requires ≥2
 * valid rows and always returns two distinct markets, else null.
 */
export function selectContrast(rows: PoolRow[]): HeroContrast | null {
  if (rows.length < 2) return null;
  const byFall = [...rows].sort(
    (a, b) =>
      a.delta - b.delta || a.score - b.score || a.cbsa.localeCompare(b.cbsa),
  );
  const byRise = [...rows].sort(
    (a, b) =>
      b.delta - a.delta || b.score - a.score || a.cbsa.localeCompare(b.cbsa),
  );
  const cooler = byFall[0];
  const riser = byRise[0].cbsa === cooler.cbsa ? byRise[1] : byRise[0];
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
      // Prefer the backend's own 3-month delta; fall back to computing it from
      // the (latest-first) history array, gap-robust.
      const delta =
        typeof piq.trend_change === "number"
          ? piq.trend_change
          : hist && hist.length >= 2
            ? hist[0].score - hist[Math.min(3, hist.length - 1)].score
            : null;
      if (delta == null) continue;

      const confidenceLevel =
        piq.confidence_level ??
        (typeof piq.confidence === "object"
          ? piq.confidence?.level
          : undefined) ??
        "A";

      rows.push({
        cbsa: s.location_id,
        name: nameByCbsa.get(s.location_id) ?? s.location_name ?? s.location_id,
        score: piq.score,
        delta,
        direction: delta >= 0 ? "up" : "down",
        confidenceLevel,
        asOf: s.score_date ?? hist?.[0]?.date ?? "",
      });
    }

    return selectContrast(rows);
  } catch {
    return null;
  }
}
