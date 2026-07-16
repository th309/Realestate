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
  metricColorScalars,
  scoreChip,
  formatExplorerValue,
  type SeriesByMetric,
} from "./explorer-math";

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
  );
  return { xByRegion, yByRegion, scoreByRegion, radiusByRegion, colorByRegion };
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
      spark: x.series.slice(windowStart),
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
) {
  const price = at(series.home_value?.[regionId], monthIndex);
  const yoy = at(
    metricSeriesFor("home_value_yoy", series, regionId),
    monthIndex,
  );
  const yld = at(metricSeriesFor("rent_yield", series, regionId), monthIndex);
  const hot = at(series.hotness_score?.[regionId], monthIndex);
  const dom = at(series.days_on_market?.[regionId], monthIndex);
  const sup = at(metricSeriesFor("supply", series, regionId), monthIndex);
  const pos = "var(--md-tertiary)",
    neg = "var(--md-error)",
    on = "var(--md-on-surface)";
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
    {
      label: "Rent yield",
      value: formatExplorerValue(yld, "percent_abs"),
      color: on,
    },
    { label: "Hotness", value: formatExplorerValue(hot, "index"), color: on },
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
