"use client";

import {
  getGradeColor,
  getScoreColor,
  getScoreLabel,
  getScoreMomentumArrow,
} from "@/app/components/scoring/ScoreDisplay";
import type { ReportInstance } from "../../../../types";
import { getTemplate, type ReportTemplateType } from "../../templates";
import { SectionErrorBoundary } from "../../SectionErrorBoundary";
import { BrandingProvider } from "../../BrandingProvider";
import { SectionCard } from "../core/SectionCard";
import { MetricsRow, type MetricItem } from "../core/MetricsRow";
import {
  type MarketBundle,
  shortMarketName,
  syntheticMarketReport,
} from "./marketBundles";
import {
  COMPARISON_SECTIONS,
  rowValue,
  SCORE_DRIVER_SECTION,
} from "./comparisonSections";

/** The single-market template a 1-geo report of this user_type would use. */
function singleMarketTemplateType(report: ReportInstance): ReportTemplateType {
  return report.user_type === "investor" ? "investoredge_v2" : "homeready_v2";
}

/** Data-first sections shown for the market, in reading order. */
const MARKET_DATA_SECTIONS = [SCORE_DRIVER_SECTION, ...COMPARISON_SECTIONS];

/** A compact score banner for one market (score, grade, momentum). */
function MarketScoreHeader({ bundle }: { bundle: MarketBundle }) {
  const { score } = bundle;
  const color = score != null ? getScoreColor(score) : "var(--report-stone)";
  // Confidence grade (data quality) only — not a score-derived percentile grade.
  const grade = bundle.grade ?? null;
  const gradeColor = grade ? getGradeColor(grade) : null;

  return (
    <div className="mb-10 flex items-center gap-4 rounded-2xl border border-outline-variant bg-surface-container p-5">
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-5xl font-bold leading-none tabular-nums"
          style={{ color }}
        >
          {score != null ? Math.round(score) : "—"}
        </span>
        {grade && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
              gradeColor?.bg ?? ""
            } ${gradeColor?.text ?? ""}`}
          >
            {grade}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold text-on-surface">
          {shortMarketName(bundle.name)} — full report
        </p>
        {score != null && (
          <p className="text-sm font-semibold" style={{ color }}>
            {getScoreMomentumArrow(score)} {getScoreLabel(score)}{" "}
            <span className="font-normal text-on-surface-variant">
              · PropertyIQ momentum
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * MarketDeepDivePanel — one market's FULL single-market report. Data-first:
 * the market's score, then its own metric sections (price, conditions, economy)
 * built from the data every comparison market carries, so it's substantial even
 * when AI prose wasn't generated. The single-market template's narrative
 * sections layer on top WHEN present (auto-hiding when not), and Market Pulse
 * (sentiment + news + economic indicators) closes it out. The watch-metrics
 * section is dropped — the data sections above already cover the metrics.
 */
export function MarketDeepDivePanel({
  report,
  bundle,
}: {
  report: ReportInstance;
  bundle: MarketBundle;
}) {
  const synthetic = syntheticMarketReport(report, bundle);
  const narrativeSections = (
    getTemplate(singleMarketTemplateType(report))?.sections ?? []
  ).filter((s) => s.id !== "what-to-watch");

  return (
    <BrandingProvider>
      <MarketScoreHeader bundle={bundle} />

      {/* Data-driven sections — always render whatever the market has. */}
      {MARKET_DATA_SECTIONS.map((section) => {
        const metrics: MetricItem[] = section.rows
          .map((row) => ({
            label: row.label,
            value: rowValue(bundle, row),
            format: row.format,
          }))
          .filter((m) => m.value !== null);
        if (metrics.length === 0) return null;
        return (
          <SectionCard
            key={section.id}
            title={section.title}
            icon={section.icon}
            className="mb-10"
          >
            {section.blurb && (
              <p className="-mt-2 mb-4 text-sm text-on-surface-variant">
                {section.blurb}
              </p>
            )}
            <MetricsRow metrics={metrics} />
          </SectionCard>
        );
      })}

      {/* AI narrative (when present) + Market Pulse, from the real template. */}
      {narrativeSections.map(({ component: Section, id }) => (
        <section key={id} id={`${bundle.id}-${id}`} className="mb-10">
          <SectionErrorBoundary sectionId={id}>
            <Section report={synthetic} />
          </SectionErrorBoundary>
        </section>
      ))}
    </BrandingProvider>
  );
}

export default MarketDeepDivePanel;
