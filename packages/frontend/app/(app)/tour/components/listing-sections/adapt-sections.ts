import { getScoreLabel } from "@/app/components/scoring/ScoreDisplay";

/**
 * Adapter: maps the backend listing-presentation `report.sections[].data` shapes
 * to the props each `listing-sections/*` component expects.
 *
 * WHY THIS EXISTS: the backend (`ListingPresentationService.generate`) emits a
 * different `data` shape than the components consume (e.g. executive-summary
 * sends `{ score: <raw ScoreResult>, thesis: <string> }` but `ExecutiveSummary`
 * needs `{ score: <mapped>, thesisParagraphs: string[], recommendation }`).
 * Passing the raw data straight through crashed 9/10 sections on real data; the
 * section unit tests masked it by mocking the ideal shape. This pure layer is
 * the single place the contract is reconciled — and it is DEFENSIVE: any section
 * whose backend data is empty/mismatched is marked `limitedData` so the component
 * degrades to its existing limited-data UI instead of throwing.
 */

export interface RawSection {
  id: string;
  data: unknown;
  limitedData: boolean;
}

// ---- small safe extractors ----
function asRecord(d: unknown): Record<string, unknown> {
  return d && typeof d === "object" && !Array.isArray(d)
    ? (d as Record<string, unknown>)
    : {};
}
function asArray(d: unknown): unknown[] {
  return Array.isArray(d) ? d : [];
}
/** A finite number from a raw value or a `{ value }` wrapper, else null. */
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (
    v &&
    typeof v === "object" &&
    typeof (v as { value?: unknown }).value === "number"
  ) {
    const n = (v as { value: number }).value;
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function splitParagraphs(t: unknown): string[] {
  if (typeof t !== "string" || !t.trim()) return [];
  return t
    .split(/\n{2,}|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
/** Confidence % → A/B/C/F letter (CLAUDE.md §9 thresholds). */
function confidenceLetter(pct: number): "A" | "B" | "C" | "F" {
  if (pct >= 80) return "A";
  if (pct >= 65) return "B";
  if (pct >= 45) return "C";
  return "F";
}
/** PropertyIQ score number out of a raw ScoreResult (tolerates flat `{score}`). */
function scoreNumber(raw: unknown): number | null {
  const r = asRecord(raw);
  const flat = num(r.score);
  if (flat != null) return flat;
  const piq = asRecord(asRecord(r.scores).propertyiq);
  return num(piq.score);
}
function scoreConfidencePct(raw: unknown): number {
  const r = asRecord(raw);
  const piq = asRecord(asRecord(r.scores).propertyiq);
  const c = num(piq.confidence) ?? num(r.confidence);
  if (c == null) return 70; // sensible default when the source omits confidence
  return Math.round(c <= 1 ? c * 100 : c);
}

// ---- market-now: metricsBatch (Record) → Stat[] ----
const METRIC_FORMAT: Record<
  string,
  { lbl: string; fmt: (n: number) => string }
> = {
  home_value: { lbl: "Median value", fmt: (n) => `$${Math.round(n / 1000)}K` },
  rent_index: { lbl: "Rent index", fmt: (n) => `$${Math.round(n)}` },
  dom_median: { lbl: "Days on market", fmt: (n) => `${Math.round(n)} days` },
  pct_sold_above_list: {
    lbl: "Sold above list",
    fmt: (n) => `${(n <= 1 ? n * 100 : n).toFixed(0)}%`,
  },
  months_supply: { lbl: "Months supply", fmt: (n) => `${n.toFixed(1)} mo` },
  sale_to_list_ratio: {
    lbl: "Sale-to-list",
    fmt: (n) => `${(n <= 2 ? n * 100 : n).toFixed(1)}%`,
  },
  price_per_sqft: { lbl: "Price / sqft", fmt: (n) => `$${Math.round(n)}` },
  household_income_median: {
    lbl: "Median income",
    fmt: (n) => `$${Math.round(n / 1000)}K`,
  },
  pct_bachelors_or_higher: {
    lbl: "Bachelor's+",
    fmt: (n) => `${(n <= 1 ? n * 100 : n).toFixed(0)}%`,
  },
};
function marketNowStats(data: unknown): { lbl: string; val: string }[] {
  const rec = asRecord(data);
  const stats: { lbl: string; val: string }[] = [];
  for (const [key, f] of Object.entries(METRIC_FORMAT)) {
    const n = num(rec[key]);
    if (n != null) stats.push({ lbl: f.lbl, val: f.fmt(n) });
  }
  return stats;
}

// ---- the adapted prop bundles (typed loosely; components own the real types) ----
export interface AdaptedSections {
  exec: Record<string, unknown>;
  market: Record<string, unknown>;
  traj: Record<string, unknown>;
  fc: Record<string, unknown>;
  peers: Record<string, unknown>;
  mig: Record<string, unknown>;
  aff: Record<string, unknown>;
  emp: Record<string, unknown>;
  val: Record<string, unknown>;
  ai: Record<string, unknown>;
}

export function adaptReportSections(sections: RawSection[]): AdaptedSections {
  const by = (id: string) => sections.find((s) => s.id === id);
  const limited = (id: string) => !!by(id)?.limitedData;

  const aiData = asRecord(by("ai-strategy")?.data);
  const execData = asRecord(by("executive-summary")?.data);

  const sNum = scoreNumber(execData.score);
  const confPct = scoreConfidencePct(execData.score);

  const recommendation = (() => {
    const a0 = asRecord(asArray(aiData.actions)[0]);
    if (typeof a0.title === "string") {
      return typeof a0.desc === "string"
        ? `${a0.title} — ${a0.desc}`
        : a0.title;
    }
    return splitParagraphs(aiData.strategy)[0] ?? "";
  })();

  const marketStats = marketNowStats(by("market-now")?.data);
  const peers = asArray(by("peers")?.data);
  const inflows = asArray(by("migration")?.data);
  const empSectors = asArray(asRecord(by("employment")?.data).sectors);

  return {
    exec: {
      score:
        sNum != null
          ? {
              score: sNum,
              label: getScoreLabel(sNum),
              confidenceLetter: confidenceLetter(confPct),
              confidencePercent: confPct,
            }
          : undefined,
      thesisParagraphs: splitParagraphs(execData.thesis),
      recommendation,
      limitedData: limited("executive-summary") || sNum == null,
    },
    market: {
      stats: marketStats,
      limitedData: limited("market-now") || marketStats.length < 4,
    },
    // Backend currently emits these four as empty stubs → render limited, never crash.
    traj: {
      marketName: "",
      parentMetroName: "",
      stateName: "",
      marketSeries: [],
      parentSeries: [],
      stateSeries: [],
      marketYoy: 0,
      parentYoy: 0,
      stateYoy: 0,
      limitedData: true,
    },
    fc: {
      historic: [],
      forecast: [],
      ciLow: [],
      ciHigh: [],
      projectedPrice: "",
      projectedRange: "",
      projectedRent: "",
      projectedRentChange: "",
      riskFactor: "",
      limitedData: true,
    },
    peers: { peers, limitedData: limited("peers") || peers.length === 0 },
    mig: {
      inflows,
      demographics: [],
      limitedData: limited("migration") || inflows.length === 0,
    },
    aff: {
      affordabilityIndex: 0,
      affordabilityMeta: "",
      affordabilityMarker: 0,
      rentVsBuyYears: 0,
      rentVsBuyMeta: "",
      rentVsBuyMarker: 0,
      limitedData: true,
    },
    emp: {
      sectors: empSectors,
      signals: [],
      limitedData: limited("employment") || empSectors.length === 0,
    },
    val: {
      directionalAccuracy: 0,
      observations: 0,
      excessReturn3y: 0,
      vsLabel: "",
      averageOutperformance: 0,
      limitedData: true,
    },
    ai: {
      thesis: typeof aiData.thesis === "string" ? aiData.thesis : "",
      strategyParagraphs: splitParagraphs(aiData.strategy),
      actions: asArray(aiData.actions),
      fallbackUsed: !!aiData.fallbackUsed,
    },
  };
}
