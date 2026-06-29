/**
 * marketBundles — normalizes a comparison report into one uniform per-market
 * shape, so the summary and the deep-dive tabs read every market the same way.
 *
 * Each market in a comparison now carries its OWN complete, standalone-shaped
 * `populated_data` (the backend runs the same assemblePopulatedData path a 1-geo
 * report uses for the primary AND every comparison market). So the primary and
 * every comparison market are read IDENTICALLY — cleaned
 * `populated_data.scores.propertyiq.{score,grade,components}`, `current` with
 * display aliases, historical + realtime. No overlaying the primary, no
 * shape-patching: each deep-dive tab is fed that market's own full payload.
 *
 * `readPiq` still tolerates the raw double-nested `scores.scores.propertyiq`
 * shape so OLDER comparison reports (generated before per-market populated_data)
 * keep rendering via the back-compat branch in `buildMarketBundles`.
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
  /**
   * This market's COMPLETE, standalone-shaped populated_data. Fed verbatim to
   * the single-market template in the deep-dive tab so it renders exactly like
   * an individual report for this market.
   */
  populatedData: Record<string, unknown>;
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

/** Build one bundle from a market's complete, standalone-shaped populated_data. */
function bundleFromPopulatedData(
  pd: Record<string, unknown>,
  meta: {
    id: string;
    name: string;
    geoLevel: string;
    isPrimary: boolean;
    narrative: Record<string, unknown> | null;
  },
): MarketBundle {
  const piq = readPiq(pd.scores);
  return {
    id: meta.id,
    name: meta.name,
    geoLevel: meta.geoLevel,
    score: piq.score,
    grade: piq.grade,
    components: piq.components,
    narrative: meta.narrative,
    realtime: pd.realtime ?? null,
    current: asRecord(pd.current),
    historical: pd.historical ? asRecord(pd.historical) : null,
    isPrimary: meta.isPrimary,
    populatedData: pd,
  };
}

/** Build the ordered market list: primary first, then comparisons in selection order. */
export function buildMarketBundles(report: unknown): MarketBundle[] {
  const r = report as Record<string, unknown>;
  const pd = asRecord(r.populated_data);
  const comparisons = asRecord(pd.comparisons);

  const bundles: MarketBundle[] = [];

  // Primary: its complete slice IS the report's populated_data. Its single-market
  // narrative lives in primary_market_narrative because report.ai_narrative holds
  // the comparison SYNTHESIS (used by the summary).
  bundles.push(
    bundleFromPopulatedData(pd, {
      id: String(r.primary_geography_id ?? "primary"),
      name: String(r.primary_geography_name ?? "Primary market"),
      geoLevel: String(r.primary_geography_type ?? ""),
      isPrimary: true,
      narrative:
        (pd.primary_market_narrative as Record<string, unknown>) ?? null,
    }),
  );

  const compGeos = Array.isArray(r.comparison_geographies)
    ? (r.comparison_geographies as Array<Record<string, unknown>>)
    : [];
  for (const geo of compGeos) {
    const comp = asRecord(comparisons[String(geo.id)]);
    const geography = asRecord(comp.geography);
    const meta = {
      id: String(geo.id),
      name: String(geography.name ?? geo.name ?? "Market"),
      geoLevel: String(geo.type ?? ""),
      isPrimary: false,
      narrative: (comp.ai_narrative as Record<string, unknown>) ?? null,
    };

    // NEW reports: this market carries its OWN complete, cleaned populated_data —
    // read it exactly like the primary.
    const compPd = comp.populated_data ? asRecord(comp.populated_data) : null;
    if (compPd) {
      bundles.push(bundleFromPopulatedData(compPd, meta));
      continue;
    }

    // BACK-COMPAT: older comparison reports stored only raw `current` + raw
    // (double-nested) scores. Synthesize a minimal standalone-shaped slice so the
    // tab still renders through the same path.
    const piq = readPiq(comp.scores);
    const legacyPd: Record<string, unknown> = {
      current: asRecord(comp.current),
      historical: comp.historical ? asRecord(comp.historical) : {},
      scores: {
        propertyiq: {
          score: piq.score ?? undefined,
          grade: piq.grade ?? undefined,
          components: piq.components ?? undefined,
        },
      },
      realtime: comp.realtime ?? null,
    };
    bundles.push(bundleFromPopulatedData(legacyPd, meta));
  }

  return bundles;
}

/**
 * A shallow ReportInstance clone whose `populated_data` IS this market's own
 * complete, standalone-shaped slice — so the single-market template renders the
 * exact full report this market would get on its own. No primary overlay, no
 * shape-patching: comparison-only keys are stripped so it reads as a 1-geo report.
 */
export function syntheticMarketReport(
  report: ReportInstance,
  bundle: MarketBundle,
): ReportInstance {
  const base = report as unknown as Record<string, unknown>;
  // Strip comparison-only keys so this looks like a standalone single-market report.
  const {
    comparisons: _comparisons,
    primary_market_narrative: _primaryNarrative,
    ...cleanPd
  } = bundle.populatedData;
  return {
    ...(report as object),
    primary_geography_id: bundle.id,
    primary_geography_name: bundle.name,
    primary_geography_type: bundle.geoLevel,
    // Legacy score fields are retired and would otherwise BLEED the primary's
    // value into this tab; the verdict badge reads populated_data.scores.propertyiq.
    homeready_score: undefined,
    investoredge_score: undefined,
    scores_snapshot: (cleanPd.scores as unknown) ?? base.scores_snapshot,
    // The market's OWN single-market narrative drives the template sections.
    ai_narrative: bundle.narrative ?? base.ai_narrative,
    populated_data: { ...cleanPd, comparisons: undefined },
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

/** Human label for a score-component key, e.g. "market_timing" → "Market Timing". */
export function componentLabel(component: string): string {
  return component.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Short tab/label name — the lead city, e.g. "Austin-Round Rock-San Marcos, TX" → "Austin". */
export function shortMarketName(name: string): string {
  const lead = name.split(/[-,]/)[0]?.trim();
  return lead && lead.length > 0 ? lead : name;
}
