/**
 * Data-interpolated SEO titles + descriptions for programmatic market pages.
 *
 * Google rewrites "micro-boilerplate" titles that vary by one token and
 * disregards near-identical descriptions across pages (rubric 05 §A2/§B2).
 * These helpers weave the real per-geo numbers — which the page body already
 * fetches (24h-cached) — into the metadata so every page is data-distinct.
 *
 * Every clause is null-guarded. When no usable stats are present (transient
 * null, or a scoreless geo that C1 will `noindex` anyway) we fall back to a
 * descriptive boilerplate so a missing fetch never yields a broken title.
 *
 * The displayed year is derived from the data's own latest period (M1), not a
 * hardcoded "2026" that goes stale on Jan 1.
 */
import { formatMetricValue } from "@/lib/data";
import type { MarketStatsData } from "@/lib/data";

/** Year of the data's latest period; falls back to the current UTC year. */
export function statYear(stats: MarketStatsData | null): number {
  const d = stats?.latestDate ? new Date(stats.latestDate) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.getUTCFullYear()
    : new Date().getUTCFullYear();
}

/** "June 2026" from a period date, or null when unparseable. */
function fmtMonthYear(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** "+5.2% YoY" / "-3.1% YoY" (value is already in percent units), or null. */
function fmtYoy(v: number | null | undefined): string | null {
  return v === null || v === undefined
    ? null
    : `${v > 0 ? "+" : ""}${v.toFixed(1)}% YoY`;
}

/** True when the geo has at least one headline fact worth interpolating. */
function hasData(stats: MarketStatsData | null): stats is MarketStatsData {
  return Boolean(
    stats &&
    (stats.score !== null || stats.headline.medianPrice.value !== null),
  );
}

/**
 * SEO `<title>`. Leads with the place + "Housing Market" (the query anchor),
 * then the single strongest number(s) available. Falls back to the descriptive
 * "{Place} Housing Market — {year} Analysis" when no data is present.
 */
export function buildMarketTitle(
  name: string,
  stats: MarketStatsData | null,
): string {
  const year = statYear(stats);
  if (!hasData(stats)) return `${name} Housing Market — ${year} Analysis`;

  const bits: string[] = [];
  const price = stats.headline.medianPrice.value;
  if (price !== null)
    bits.push(`${formatMetricValue(price, "currency")} Median`);
  if (stats.score !== null) bits.push(`PropertyIQ Score ${stats.score}`);

  return `${name} Housing Market: ${bits.join(", ")} (${year})`;
}

/**
 * SEO meta description. Weaves the standout numbers into a sentence, dropping
 * any null clause; falls back to descriptive boilerplate when no data exists.
 */
export function buildMarketDescription(
  name: string,
  stats: MarketStatsData | null,
): string {
  const year = statYear(stats);
  if (!hasData(stats)) {
    return `${name} housing market data — home prices, PropertyIQ demand score, investment analysis, and rental trends. Updated ${year}.`;
  }

  const clauses: string[] = [];
  const price = stats.headline.medianPrice.value;
  const yoy = fmtYoy(stats.headline.yoy.value);
  const dom = stats.headline.daysOnMarket.value;

  if (price !== null) {
    clauses.push(
      `median home price ${formatMetricValue(price, "currency")}${yoy ? ` (${yoy})` : ""}`,
    );
  }
  // Grade is DATA CONFIDENCE (A/B/C/F), not a score grade — placing it beside
  // the score misreads as a quality grade, so it's omitted from the snippet.
  if (stats.score !== null) {
    clauses.push(`PropertyIQ demand score ${stats.score}`);
  }
  if (dom !== null)
    clauses.push(`homes sell in a median ${Math.round(dom)} days`);

  const asOf = fmtMonthYear(stats.latestDate) ?? String(year);
  return `${name} housing market: ${clauses.join(", ")}. Updated ${asOf}.`;
}

/**
 * Data-distinct lead paragraph for the page body: the real per-geo numbers
 * woven into prose so the body varies in *substance*, not just the place name
 * (rubric 01 §B1 scaled-content). Returns null when no usable stats exist — the
 * page then opens with the methodology template, and C1 will already have
 * `noindex`'d a truly scoreless geo.
 *
 * The PropertyIQ Score is calibrated so 50 = the market's own state average, so
 * comparing to 50 *is* the state comparison — no need to name the state. Grade
 * is data confidence (not a score grade) and is intentionally left out here.
 */
export function buildMarketDataSummary(
  name: string,
  stats: MarketStatsData | null,
): string | null {
  if (!hasData(stats)) return null;

  const sentences: string[] = [];

  const price = stats.headline.medianPrice.value;
  const yoy = stats.headline.yoy.value;
  if (price !== null) {
    const trend =
      yoy === null
        ? ""
        : yoy > 0
          ? `, up ${yoy.toFixed(1)}% over the past year`
          : yoy < 0
            ? `, down ${Math.abs(yoy).toFixed(1)}% over the past year`
            : ", essentially flat over the past year";
    sentences.push(
      `${name}'s median home value is ${formatMetricValue(price, "currency")}${trend}.`,
    );
  }

  const dom = stats.headline.daysOnMarket.value;
  if (dom !== null) {
    sentences.push(`Homes here sell in a median ${Math.round(dom)} days.`);
  }

  if (stats.score !== null) {
    const s = stats.score;
    const read =
      s >= 60
        ? "well above the state average of 50, marking a market positioned to outperform its state over the next three years"
        : s >= 50
          ? "right around the state average of 50"
          : s >= 40
            ? "modestly below the state average of 50"
            : "below the state average of 50, marking a market positioned to lag its state over the next three years";
    sentences.push(`Its PropertyIQ Score of ${s} sits ${read}.`);
  }

  return sentences.join(" ");
}
