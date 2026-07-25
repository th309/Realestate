import { formatMetricValue } from "@/lib/data";
import type { ScopeRegion } from "@/lib/data/fetchers/market-explorer";
import {
  EXPLORER_METRICS,
  type ExplorerMetricId,
  type ExplorerFormat,
} from "./explorer-config";

export type Series = (number | null)[];
export type SeriesByMetric = Record<string, Record<string, Series>>;

/** Lookback window for BOTH the KPI strip's/detail rail's trend-delta badges
 * AND the small sparkline charts under them — fixed at 6 months regardless
 * of the "range" preset (6M/1Y/2Y/5Y/10Y) that governs the main hero
 * chart's timeline scrubber. Those are two different concerns: the range
 * preset controls how much history the user can scrub through; this
 * constant controls how much RECENT history a quick-glance trend indicator
 * shows, which should stay a small, consistent, comparable window no matter
 * how far back the user has zoomed the main timeline out to. */
export const TREND_WINDOW_MONTHS = 6;

export function deriveYoY(home: Series): Series {
  return home.map((_, t) => {
    const cur = home[t],
      prev = home[t - 12];
    return cur != null && prev != null && prev !== 0
      ? (cur / prev - 1) * 100
      : null;
  });
}

export function deriveYield(rent: Series, home: Series): Series {
  return rent.map((_, t) => {
    const r = rent[t],
      h = home[t];
    return r != null && h != null && h !== 0 ? ((r * 12) / h) * 100 : null;
  });
}

/**
 * Months of supply — DERIVED: active listings ÷ monthly pending sales.
 * (No native MoS time-series exists; see Global Constraints. Fallback: hold the
 * current screener value flat if Task 6's reconciliation check fails.)
 */
export function deriveMonthsOfSupply(active: Series, pending: Series): Series {
  return active.map((_, t) => {
    const a = active[t],
      p = pending[t];
    return a != null && p != null && p !== 0 ? a / p : null;
  });
}

const EMPTY: Series = [];

export function metricSeriesFor(
  metricId: ExplorerMetricId,
  series: SeriesByMetric,
  regionId: string,
): Series {
  const cfg = EXPLORER_METRICS.find((m) => m.id === metricId)!;
  if (cfg.source.kind === "fetched")
    return series[cfg.source.series]?.[regionId] ?? EMPTY;
  const home = series.home_value?.[regionId] ?? EMPTY;
  if (cfg.source.deriver === "yoy") return deriveYoY(home);
  if (cfg.source.deriver === "yield")
    return deriveYield(series.rent_index?.[regionId] ?? EMPTY, home);
  return deriveMonthsOfSupply(
    series.for_sale_inventory?.[regionId] ?? EMPTY,
    series.home_sales?.[regionId] ?? EMPTY,
  );
}

function reduceMonth(
  ids: string[],
  byRegion: Record<string, Series> | undefined,
  t: number,
  sum: boolean,
): number | null {
  if (!byRegion) return null;
  let acc = 0,
    n = 0;
  for (const id of ids) {
    const v = byRegion[id]?.[t];
    if (v != null) {
      acc += v;
      n++;
    }
  }
  if (!n) return null;
  return sum ? acc : acc / n;
}

/** Scope-wide KPI series — mean (or sum, for inventory) across every region
 * currently in view. This is the CURRENT SCOPE's own aggregate (e.g. all of
 * Colorado's metros when drilled into Colorado), distinct from whatever
 * single region is selected/highlighted — the KPI strip tracks the scope
 * itself; the detail rail tracks the selection. See MarketExplorer.tsx. */
export function aggregateScopeKpis(
  ids: string[],
  series: SeriesByMetric,
  length: number,
) {
  const build = (metric: string, sum: boolean): Series =>
    Array.from({ length }, (_, t) => reduceMonth(ids, series[metric], t, sum));
  const price = build("home_value", false);
  return {
    price,
    rent: build("rent_index", false),
    inventory: build("for_sale_inventory", true),
    dom: build("days_on_market", false),
    score: build("propertyiq_score", false),
    // State-scope-only substitutes — states have no native PropertyIQ score
    // (see me_state_score_series' mean-of-metros proxy) and no rent_index
    // coverage in zillow_state, so the KPI strip swaps these two in for the
    // state scope specifically (see KpiStrip's `isStateScope` prop).
    // homeValueYoy is free (derived from the aggregate price series already
    // computed above); unemployment is fetched by the backend only for
    // state-scope requests, so it's an empty series everywhere else.
    homeValueYoy: deriveYoY(price),
    unemployment: build("unemployment_rate", false),
  };
}

export function computeMovers(
  regions: ScopeRegion[],
  scoreByRegion: Record<string, Series>,
  monthIndex: number,
): { region: ScopeRegion; delta: number; score: number }[] {
  const prior = Math.max(0, monthIndex - 3);
  const deltas = regions
    .map((region) => {
      const s = scoreByRegion[region.id];
      const cur = s?.[monthIndex],
        was = s?.[prior];
      if (cur == null || was == null) return null;
      return { region, delta: cur - was, score: Math.round(cur) };
    })
    .filter(
      (x): x is { region: ScopeRegion; delta: number; score: number } =>
        x !== null,
    )
    .sort((a, b) => b.delta - a.delta);
  const top = [...deltas.slice(0, 3), ...deltas.slice(-3)];
  return top.filter(
    (x, i, arr) => arr.findIndex((y) => y.region.id === x.region.id) === i,
  );
}

export function scoreChip(score: number): { bg: string; color: string } {
  if (score >= 80)
    return {
      bg: "color-mix(in srgb, var(--md-tertiary) 14%, transparent)",
      color: "var(--md-tertiary)",
    };
  if (score >= 60)
    return {
      bg: "color-mix(in srgb, var(--md-primary) 13%, transparent)",
      color: "var(--md-primary)",
    };
  if (score >= 40)
    return {
      bg: "color-mix(in srgb, var(--md-warning) 15%, transparent)",
      color: "var(--md-warning)",
    };
  return {
    bg: "color-mix(in srgb, var(--md-error) 13%, transparent)",
    color: "var(--md-error)",
  };
}

/**
 * Latest month index with a real (non-null) PropertyIQ score for at least one
 * region. Different sources publish on different monthly cadences (Zillow vs
 * Realtor.com), so the raw date union's last index can be a month where every
 * score is still null — landing there would blank out the detail rail's score
 * gauge and the KPI strip's score/value/rent cards on default load. Scans
 * backward to the latest scored month, falling back to the raw last index if
 * no scored month exists yet (e.g. a brand-new scope with no score data at
 * all).
 */
export function latestScoredMonthIndex(
  scoreByRegion: Record<string, Series> | undefined,
  length: number,
): number {
  if (scoreByRegion) {
    for (let i = length - 1; i >= 0; i--) {
      if (Object.values(scoreByRegion).some((arr) => arr[i] != null)) return i;
    }
  }
  return Math.max(0, length - 1);
}

/** Delegates to the registry formatter; adds the day/month unit suffixes the prototype uses. */
export function formatExplorerValue(
  value: number | null | undefined,
  format: ExplorerFormat,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  switch (format) {
    case "index":
      return formatMetricValue(value, "index");
    case "percent":
      return formatMetricValue(value, "percent");
    case "percent_abs":
      return formatMetricValue(value, "percent_abs");
    case "days":
      return `${formatMetricValue(value, "number")} d`;
    case "months":
      return `${value.toFixed(1)} mo`;
  }
}
