/**
 * marketBundles — normalizes a comparison report into one uniform per-market
 * shape, so the summary and the deep-dive tabs read every market the same way.
 *
 * WHY THIS EXISTS: the comparison report previously read DEAD legacy scores
 * (homeready/investoredge) so every comparison market showed "No Score". The
 * live score is PropertyIQ, but it sits at DIFFERENT nesting for the primary vs
 * comparison markets: the backend assembly CLEANS the primary into
 * `populated_data.scores.propertyiq.{score,grade,components}` while each
 * comparison market keeps the RAW `getScore()` result at
 * `comparisons[id].scores.scores.propertyiq`. `readPiq` handles both (plus a
 * flat-number legacy fallback) so a market can never silently show "No Score".
 */

import type { ReportInstance } from "../../../../types";

/** One score-driver component (PropertyIQ breakdown), loosely typed. */
export interface BundleScoreComponent {
  component: string;
  score: number;
  status: string;
}

export interface MarketBundle {
  id: string;
  name: string;
  geoLevel: string;
  score: number | null;
  grade: string | null;
  /** PropertyIQ score-driver breakdown, if the backend included components. */
  components: BundleScoreComponent[] | null;
  /** Per-market SINGLE-MARKET AI narrative (drives this market's deep-dive tab). */
  narrative: Record<string, unknown> | null;
  /** This market's OWN news/realtime block (so its deep-dive shows ITS news). */
  realtime: unknown;
  current: Record<string, unknown>;
  historical: Record<string, unknown> | null;
  isPrimary: boolean;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/** Pull live PropertyIQ score + grade + components out of either score nesting. */
function readPiq(scores: unknown): {
  score: number | null;
  grade: string | null;
  components: BundleScoreComponent[] | null;
} {
  const s = scores as
    | {
        propertyiq?:
          | { score?: unknown; grade?: unknown; components?: unknown }
          | number;
        scores?: {
          propertyiq?: {
            score?: unknown;
            grade?: unknown;
            components?: unknown;
          };
        };
      }
    | null
    | undefined;
  // Cleaned primary shape OR raw comparison shape.
  const piq =
    (s && typeof s.propertyiq === "object" ? s.propertyiq : undefined) ??
    s?.scores?.propertyiq;
  if (piq && typeof piq === "object") {
    const rawComponents = Array.isArray(piq.components) ? piq.components : [];
    const components: BundleScoreComponent[] = rawComponents
      .map((c) => {
        const r = asRecord(c);
        const score = typeof r.score === "number" ? r.score : null;
        const component = typeof r.component === "string" ? r.component : null;
        if (score == null || !component) return null;
        return {
          component,
          score,
          status: typeof r.status === "string" ? r.status : "moderate",
        };
      })
      .filter((c): c is BundleScoreComponent => c !== null);
    return {
      score: typeof piq.score === "number" ? piq.score : null,
      grade: typeof piq.grade === "string" ? piq.grade : null,
      components: components.length > 0 ? components : null,
    };
  }
  // Legacy flat-number fallback.
  const flat = s?.propertyiq;
  return {
    score: typeof flat === "number" ? flat : null,
    grade: null,
    components: null,
  };
}

/** Build the ordered market list: primary first, then comparisons in selection order. */
export function buildMarketBundles(report: unknown): MarketBundle[] {
  const r = report as Record<string, unknown>;
  const pd = asRecord(r.populated_data);
  const comparisons = asRecord(pd.comparisons);

  const bundles: MarketBundle[] = [];

  const primaryPiq = readPiq(pd.scores);
  bundles.push({
    id: String(r.primary_geography_id ?? "primary"),
    name: String(r.primary_geography_name ?? "Primary market"),
    geoLevel: String(r.primary_geography_type ?? ""),
    score: primaryPiq.score,
    grade: primaryPiq.grade,
    components: primaryPiq.components,
    // Primary's single-market narrative lives in a dedicated field because
    // report.ai_narrative holds the comparison SYNTHESIS (used by the summary).
    narrative: (pd.primary_market_narrative as Record<string, unknown>) ?? null,
    realtime: pd.realtime ?? null,
    current: asRecord(pd.current),
    historical: pd.historical ? asRecord(pd.historical) : null,
    isPrimary: true,
  });

  const compGeos = Array.isArray(r.comparison_geographies)
    ? (r.comparison_geographies as Array<Record<string, unknown>>)
    : [];
  for (const geo of compGeos) {
    const comp = asRecord(comparisons[String(geo.id)]);
    const piq = readPiq(comp.scores);
    const geography = asRecord(comp.geography);
    bundles.push({
      id: String(geo.id),
      name: String(geography.name ?? geo.name ?? "Market"),
      geoLevel: String(geo.type ?? ""),
      score: piq.score,
      grade: piq.grade,
      components: piq.components,
      narrative: (comp.ai_narrative as Record<string, unknown>) ?? null,
      realtime: comp.realtime ?? null,
      current: asRecord(comp.current),
      historical: comp.historical ? asRecord(comp.historical) : null,
      isPrimary: false,
    });
  }

  return bundles;
}

/**
 * A shallow ReportInstance clone whose `populated_data` is ONE market's bundle,
 * so report-coupled section components (ChartSingle, ForecastDisplay, …) render
 * that market's data without modification. This is the key to reusing the real
 * single-market visualizations for every market in a comparison.
 */
export function syntheticMarketReport(
  report: ReportInstance,
  bundle: MarketBundle,
): ReportInstance {
  const base = report as unknown as Record<string, unknown>;
  const basePd = asRecord(base.populated_data);
  const scores = {
    propertyiq: {
      score: bundle.score ?? undefined,
      grade: bundle.grade ?? undefined,
      components: bundle.components ?? undefined,
    },
  };
  return {
    ...(report as object),
    primary_geography_id: bundle.id,
    primary_geography_name: bundle.name,
    primary_geography_type: bundle.geoLevel,
    homeready_score: bundle.score ?? undefined,
    investoredge_score: bundle.score ?? undefined,
    scores_snapshot: scores,
    // The market's OWN single-market narrative drives the single-market template
    // sections in its deep-dive tab.
    ai_narrative: bundle.narrative ?? base.ai_narrative,
    populated_data: {
      ...basePd,
      current: bundle.current,
      historical: bundle.historical ?? {},
      scores,
      // Each market's deep-dive must show ITS own news, not the primary's.
      realtime: bundle.realtime ?? basePd.realtime,
      // A synthetic single-market report must not look like a comparison.
      comparisons: undefined,
    },
  } as unknown as ReportInstance;
}

/** A finite number from a metric value (handles string-encoded numbers), else null. */
export function metricNum(
  current: Record<string, unknown>,
  key: string,
): number | null {
  const v = current[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Format a metric value. Percent values may arrive as a ratio (0.048) or a percent (4.8). */
export function formatComparisonMetric(
  n: number | null,
  format: "currency" | "percent" | "number" | "days",
): string {
  if (n == null) return "—";
  switch (format) {
    case "currency":
      return Math.abs(n) >= 1_000_000
        ? `$${(n / 1_000_000).toFixed(2)}M`
        : `$${Math.round(n / 1000)}K`;
    case "percent": {
      const pct = Math.abs(n) <= 1 ? n * 100 : n;
      return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
    }
    case "days":
      return `${Math.round(n)} days`;
    case "number":
      return `${Math.round(n)}`;
  }
}

/** Human label for a score-component key, e.g. "market_timing" → "Market Timing". */
export function componentLabel(component: string): string {
  return component.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Short tab/label name — the lead city, e.g. "Austin-Round Rock-San Marcos, TX" → "Austin". */
export function shortMarketName(name: string): string {
  const lead = name.split(/[-,]/)[0]?.trim();
  return lead && lead.length > 0 ? lead : name;
}
