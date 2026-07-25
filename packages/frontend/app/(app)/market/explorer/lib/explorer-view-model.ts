import { getScoreLabel } from "@/app/components/scoring/ScoreDisplay";
import { formatMetricValue, titleCaseLocationName } from "@/lib/data";
import type { ScopeRegion } from "@/lib/data/fetchers/market-explorer";
import type { LeaderboardRow } from "../components/Leaderboard";
import {
  EXPLORER_METRICS,
  FETCHED_METRICS,
  type ExplorerMetricId,
} from "./explorer-config";
import {
  metricSeriesFor,
  scoreChip,
  formatExplorerValue,
  type SeriesByMetric,
} from "./explorer-math";
import { metricColorScalars } from "./explorer-scale";

const at = (arr: (number | null)[] | undefined, i: number): number | null =>
  arr ? (arr[i] ?? null) : null;
const lastNonNull = (arr?: (number | null)[]): number | null => {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]!;
  return null;
};

export function buildBubbleScalars(
  entities: ScopeRegion[],
  series: SeriesByMetric,
  metricId: ExplorerMetricId,
  monthIndex: number,
  /** Precomputed GLOBAL [lo, hi] color bounds (see `collectAllMetricValues` +
   * `computeMetricBounds`) — REQUIRED for animated playback (AnimatedHeroChart),
   * since recomputing bounds fresh from just this one month's snapshot makes
   * the whole color scale rescale every tick. Omitted for the plain,
   * non-animated single-month usage (KPI strip/leaderboard/etc. in
   * MarketExplorer.tsx), which is unaffected by this concern. */
  colorBounds?: [number, number],
) {
  const xByRegion: Record<string, number | null> = {};
  const yByRegion: Record<string, number | null> = {};
  const scoreByRegion: Record<string, number | null> = {};
  const radiusByRegion: Record<string, number | null> = {};
  for (const e of entities) {
    xByRegion[e.id] = at(series.home_value?.[e.id], monthIndex);
    yByRegion[e.id] = at(metricSeriesFor(metricId, series, e.id), monthIndex);
    scoreByRegion[e.id] = at(series.propertyiq_score?.[e.id], monthIndex);
    radiusByRegion[e.id] = lastNonNull(series.for_sale_inventory?.[e.id]);
  }
  // Color must track whichever metric is currently selected (yByRegion),
  // not always PropertyIQ Score — scoreByRegion above stays the REAL score
  // for the gauge/chips/momentum donut, which must never change with the
  // metric switcher.
  const cfg = EXPLORER_METRICS.find((m) => m.id === metricId)!;
  const colorByRegion = metricColorScalars(
    yByRegion,
    cfg.format,
    cfg.betterHigh,
    colorBounds,
  );
  return { xByRegion, yByRegion, scoreByRegion, radiusByRegion, colorByRegion };
}

/** The 4 blendable fields of a `buildBubbleScalars` snapshot — everything a
 * caller needs to interpolate toward the next month's positions/color.
 * `scoreByRegion` is deliberately excluded: the PropertyIQ score gauge
 * always snaps to the current month, never blends (see AnimatedHeroChart). */
export type BubbleBlendScalars = Pick<
  ReturnType<typeof buildBubbleScalars>,
  "xByRegion" | "yByRegion" | "colorByRegion" | "radiusByRegion"
>;

/**
 * All non-null values for a metric, across every region AND every month —
 * used to build STABLE, GLOBAL scale bounds for animated playback (position
 * + color axes must stay fixed while dots/tiles move; see `buildBubbleScalars`'s
 * `colorBounds` param and BubbleChart's `yBounds`/`xBounds` props).
 */
export function collectAllMetricValues(
  entities: ScopeRegion[],
  series: SeriesByMetric,
  metricId: ExplorerMetricId,
): number[] {
  const values: number[] = [];
  for (const e of entities) {
    for (const v of metricSeriesFor(metricId, series, e.id)) {
      if (v != null) values.push(v);
    }
  }
  return values;
}

export function buildLeaderboardRows(
  entities: ScopeRegion[],
  series: SeriesByMetric,
  metricId: ExplorerMetricId,
  monthIndex: number,
  windowStart: number,
  listCount: number,
): LeaderboardRow[] {
  const cfg = EXPLORER_METRICS.find((m) => m.id === metricId)!;
  const dir = cfg.betterHigh ? -1 : 1;
  const withVal = entities
    .map((e) => ({
      e,
      series: metricSeriesFor(metricId, series, e.id),
      score: at(series.propertyiq_score?.[e.id], monthIndex),
    }))
    .map((x) => ({ ...x, v: at(x.series, monthIndex) }))
    .filter((x) => x.v != null)
    .sort((a, b) => dir * ((a.v as number) - (b.v as number)))
    .slice(0, listCount);

  return withVal.map((x, i) => {
    const score = Math.round(x.score ?? 50);
    const chip = scoreChip(score);
    const price = at(series.home_value?.[x.e.id], monthIndex);
    const isScore = metricId === "score";
    return {
      id: x.e.id,
      rank: String(i + 1).padStart(2, "0"),
      name: titleCaseLocationName(x.e.name),
      sub: `${x.e.state}${price != null ? ` · ${formatMetricValue(price, "currency")}` : ""}`,
      valueLabel: isScore
        ? getScoreLabel(score)
        : formatExplorerValue(x.v, cfg.format),
      valueColor: isScore ? chip.color : "var(--md-on-surface)",
      score,
      scoreBg: chip.bg,
      scoreColor: chip.color,
      // Upper-bounded at monthIndex+1 — without it, .slice(windowStart)
      // runs to the end of the FULL fetched series, which is one month
      // beyond "now" whenever monthIndex isn't the array's last index (e.g.
      // state scope, whose default month is anchored to unemployment_rate's
      // latest month — 1 month behind the rest of the dataset since FRED
      // lags). Same root cause fixed in KpiStrip/ExplorerDetailRail.
      spark: x.series.slice(windowStart, monthIndex + 1),
      markerIndex: Math.max(0, monthIndex - windowStart),
    };
  });
}

export function coverageConfidence(
  series: SeriesByMetric,
  regionId: string,
  monthIndex: number,
  latestDate: string,
) {
  const available = FETCHED_METRICS.filter(
    (m) => at(series[m]?.[regionId], monthIndex) != null,
  ).length;
  const percentage = Math.round((available / FETCHED_METRICS.length) * 100);
  const level: "a" | "b" | "c" | "f" =
    percentage >= 80
      ? "a"
      : percentage >= 65
        ? "b"
        : percentage >= 45
          ? "c"
          : "f";
  const freshnessInDays = latestDate
    ? Math.max(
        0,
        Math.round(
          (Date.now() -
            new Date(`${latestDate.slice(0, 10)}T00:00:00`).getTime()) /
            86400000,
        ),
      )
    : 0;
  return {
    level,
    percentage,
    metricsAvailable: available,
    metricsTotal: FETCHED_METRICS.length,
    freshnessInDays,
  };
}

export function buildDetailStats(
  series: SeriesByMetric,
  regionId: string,
  monthIndex: number,
  /** States have no rent_index or hotness_score coverage at all — those 2
   * cards would always read "—" for every state. Swaps them for this one
   * region's own unemployment rate and new-listings count, both of which
   * ARE available at state level. */
  isStateScope = false,
) {
  const price = at(series.home_value?.[regionId], monthIndex);
  const yoy = at(
    metricSeriesFor("home_value_yoy", series, regionId),
    monthIndex,
  );
  const dom = at(series.days_on_market?.[regionId], monthIndex);
  const sup = at(metricSeriesFor("supply", series, regionId), monthIndex);
  const pos = "var(--md-tertiary)",
    neg = "var(--md-error)",
    on = "var(--md-on-surface)";

  const secondRow = isStateScope
    ? [
        {
          label: "Unemployment",
          value: formatExplorerValue(
            at(series.unemployment_rate?.[regionId], monthIndex),
            "percent_abs",
          ),
          color: on,
        },
        {
          label: "New listings",
          value: formatMetricValue(
            at(series.new_listings?.[regionId], monthIndex),
            "number",
          ),
          color: on,
        },
      ]
    : [
        {
          label: "Rent yield",
          value: formatExplorerValue(
            at(metricSeriesFor("rent_yield", series, regionId), monthIndex),
            "percent_abs",
          ),
          color: on,
        },
        {
          label: "Hotness",
          value: formatExplorerValue(
            at(series.hotness_score?.[regionId], monthIndex),
            "index",
          ),
          color: on,
        },
      ];

  return [
    {
      label: "Median value",
      value: formatMetricValue(price, "currency"),
      color: on,
    },
    {
      label: "Value YoY",
      value: formatExplorerValue(yoy, "percent"),
      color: (yoy ?? 0) >= 0 ? pos : neg,
    },
    ...secondRow,
    {
      label: "Days on mkt",
      value: formatExplorerValue(dom, "days"),
      color: on,
    },
    {
      label: "Mo. supply",
      value: formatExplorerValue(sup, "months"),
      color: on,
    },
  ];
}
