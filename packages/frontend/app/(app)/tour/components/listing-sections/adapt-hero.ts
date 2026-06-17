/**
 * Hero bundle for the listing-presentation finale (the conversion moment).
 *
 * Pulls the single highest-impact facts out of the raw report sections — the
 * PropertyIQ Score, a plain-English verdict, and 3–4 KPI tiles (with sparkline
 * series where history exists) — for the above-the-fold `ReportHero`. Any KPI
 * whose source value is missing is simply omitted (never an empty tile).
 */

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
import type { RawSection } from "./adapt-sections";

export interface HeroKpi {
  label: string;
  value: string;
  sub?: string;
  /** Signed % change, rendered as a ▲/▼ chip when present. */
  deltaPct?: number;
  /** Series for a sparkline; omitted when no history is available. */
  spark?: number[];
  /** Drives the delta chip color (green/red). */
  favorable?: boolean;
}

export interface HeroScore {
  score: number;
  label: string;
  confidenceLetter: string;
  confidencePercent: number;
}

export interface HeroBundle {
  marketName: string;
  score: HeroScore | null;
  verdict: string;
  kpis: HeroKpi[];
}

export function buildHero(sections: RawSection[]): HeroBundle {
  const by = (id: string) => sections.find((s) => s.id === id);

  const execData = asRecord(by("executive-summary")?.data);
  const aiData = asRecord(by("ai-strategy")?.data);
  const marketRaw = asRecord(by("market-now")?.data);
  const fcData = asRecord(by("forecast")?.data);

  const sNum = scoreNumber(execData.score);
  const confPct = scoreConfidencePct(execData.score);

  // The trajectory's first series is the market itself, labeled with the
  // server-resolved market name — the most reliable display name available.
  const trajData = asRecord(by("trajectory-12mo")?.data);
  const trajFirst = asRecord(asArray(trajData.series)[0]);
  const marketName = str(trajFirst.label);
  const trajValues = numArray(trajFirst.values);
  const trajYoy = num(trajFirst.yoy);

  // Verdict: lead with the AI thesis; fall back to the top recommended action.
  const verdict = (() => {
    const thesisLead = splitParagraphs(execData.thesis)[0];
    if (thesisLead) return thesisLead;
    const a0 = asRecord(asArray(aiData.actions)[0]);
    if (typeof a0.title === "string") {
      return typeof a0.desc === "string"
        ? `${a0.title} — ${a0.desc}`
        : a0.title;
    }
    return splitParagraphs(aiData.strategy)[0] ?? "";
  })();

  const homeValue = num(marketRaw.home_value);
  const dom = num(marketRaw.dom_median);
  const supply = num(marketRaw.months_supply);
  const projectedValue = num(fcData.projectedValue);
  const f12 = num(fcData.forecast12mPct);
  const fcHistoric = numArray(fcData.historic);
  const fcForecast = numArray(fcData.forecast);

  const kpis: HeroKpi[] = [];
  if (homeValue != null) {
    kpis.push({
      label: "Median home value",
      value: formatUsdK(homeValue),
      deltaPct: trajYoy ?? undefined,
      spark: trajValues.length >= 2 ? trajValues : undefined,
      favorable: (trajYoy ?? 0) >= 0,
    });
  }
  if (projectedValue != null && f12 != null) {
    kpis.push({
      label: "12-month forecast",
      value: `${f12 >= 0 ? "+" : ""}${f12.toFixed(1)}%`,
      sub: `→ ${formatUsdK(projectedValue)}`,
      spark:
        fcHistoric.length + fcForecast.length >= 2
          ? [...fcHistoric.slice(-6), ...fcForecast]
          : undefined,
      favorable: f12 >= 0,
    });
  }
  if (dom != null) {
    kpis.push({
      label: "Days on market",
      value: `${Math.round(dom)}`,
      sub: "median",
    });
  }
  if (supply != null) {
    kpis.push({
      label: "Months of supply",
      value: supply.toFixed(1),
      sub: "inventory",
    });
  }

  return {
    marketName,
    score:
      sNum != null
        ? {
            score: sNum,
            label: getScoreLabel(sNum),
            confidenceLetter: confidenceLetter(confPct),
            confidencePercent: confPct,
          }
        : null,
    verdict,
    kpis,
  };
}
