import { getScoreLabel } from "@/app/components/scoring/ScoreDisplay";
import {
  asRecord,
  asArray,
  num,
  str,
  numArray,
  splitParagraphs,
  formatUsdK,
  confidenceLetter,
  scoreNumber,
  scoreConfidencePct,
} from "./adapt-utils";
import { buildHero, type HeroBundle } from "./adapt-hero";

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
  hero: HeroBundle;
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
  // ExecutiveSummary renders the thesis narrative (the score lives in the hero),
  // so its emptiness — and therefore whether the parent drops it — keys off the
  // thesis, matching the component's own null-render condition.
  const execThesis = splitParagraphs(execData.thesis);

  // ai-strategy: the only section the backend never flags; emptiness = no
  // narrative at all (mirrors AiStrategy's internal `hasContent`).
  const aiThesis = typeof aiData.thesis === "string" ? aiData.thesis : "";
  const aiStrategyParagraphs = splitParagraphs(aiData.strategy);

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

  // --- trajectory: { series: [{ label, values, yoy }] } ---
  const trajData = asRecord(by("trajectory-12mo")?.data);
  const trajSeries = asArray(trajData.series)
    .map((s) => {
      const r = asRecord(s);
      return {
        label: str(r.label),
        values: numArray(r.values),
        yoy: num(r.yoy) ?? 0,
      };
    })
    .filter((s) => s.values.length >= 2);

  // --- forecast: numeric arrays for the chart + formatted summary cards ---
  const fcData = asRecord(by("forecast")?.data);
  const fcForecast = numArray(fcData.forecast);
  const projectedValue = num(fcData.projectedValue);
  const ciLow12 = num(fcData.ciLow12);
  const ciHigh12 = num(fcData.ciHigh12);
  const f12 = num(fcData.forecast12mPct);

  // --- affordability ---
  const affData = asRecord(by("affordability")?.data);
  const affIndex = num(affData.affordabilityIndex);
  const pti = num(affData.priceToIncome);
  const ptr = num(affData.priceToRent);
  const hasPtr = !!affData.hasPriceToRent && ptr != null && ptr > 0;

  // --- validation (sanctioned geo-type-level stats) ---
  const valData = asRecord(by("validation")?.data);
  const metrosValidated = num(valData.metrosValidated);

  return {
    hero: buildHero(sections),
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
      thesisParagraphs: execThesis,
      recommendation,
      limitedData: limited("executive-summary") || execThesis.length === 0,
    },
    market: {
      stats: marketStats,
      limitedData: limited("market-now") || marketStats.length < 4,
    },
    traj: {
      series: trajSeries,
      limitedData: limited("trajectory-12mo") || trajSeries.length === 0,
    },
    fc: {
      historic: numArray(fcData.historic),
      forecast: fcForecast,
      ciLow: numArray(fcData.ciLow),
      ciHigh: numArray(fcData.ciHigh),
      projectedPrice: projectedValue != null ? formatUsdK(projectedValue) : "",
      projectedRange:
        ciLow12 != null && ciHigh12 != null
          ? `${formatUsdK(ciLow12)} – ${formatUsdK(ciHigh12)} · 80% modeled interval`
          : "",
      projectedChange:
        f12 != null ? `${f12 >= 0 ? "+" : ""}${f12.toFixed(1)}% vs today` : "",
      limitedData:
        limited("forecast") ||
        fcForecast.length === 0 ||
        projectedValue == null,
    },
    peers: { peers, limitedData: limited("peers") || peers.length === 0 },
    mig: {
      inflows,
      demographics: [],
      limitedData: limited("migration") || inflows.length === 0,
    },
    aff: {
      affordabilityIndex: affIndex ?? 0,
      affordabilityMeta:
        pti != null ? `Median home ≈ ${pti.toFixed(1)}× median income` : "",
      affordabilityMarker: num(affData.affordabilityMarker) ?? 0,
      priceToRent: ptr ?? 0,
      priceToRentMeta: hasPtr
        ? `Median home ≈ ${(ptr as number).toFixed(1)}× annual rent`
        : "",
      priceToRentMarker: num(affData.priceToRentMarker) ?? 0,
      hasPriceToRent: hasPtr,
      limitedData: limited("affordability") || affIndex == null || pti == null,
    },
    emp: {
      sectors: empSectors,
      signals: [],
      limitedData: limited("employment") || empSectors.length === 0,
    },
    val: {
      metrosValidated: metrosValidated ?? 0,
      countiesValidated: num(valData.countiesValidated) ?? 0,
      zipsValidated: num(valData.zipsValidated) ?? 0,
      backtestYears: num(valData.backtestYears) ?? 0,
      dollarAlpha: str(valData.dollarAlpha),
      icStatement: str(valData.icStatement),
      outperformanceStatement: str(valData.outperformanceStatement),
      hitRateStatement: str(valData.hitRateStatement),
      limitedData: limited("validation") || metrosValidated == null,
    },
    ai: {
      thesis: aiThesis,
      strategyParagraphs: aiStrategyParagraphs,
      actions: asArray(aiData.actions),
      fallbackUsed: !!aiData.fallbackUsed,
      limitedData: !aiThesis && aiStrategyParagraphs.length === 0,
    },
  };
}
