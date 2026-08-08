"use client";

import { BarChart3 } from "lucide-react";
import type { Letter, MetricResult } from "@propertyiq/analyzer-core";
import { getGradeColor } from "../../lib/grade-colors";
import { getMetricHelp } from "../../lib/metric-help";
import { MetricHelpButton } from "./MetricHelpButton";
import { PiqCard, PiqCardHeader } from "../primitives/card";

interface ScoreBreakdownTableProps {
  metrics: MetricResult[];
  rawGpa: number;
  marketAdjustment: number;
  finalGpa: number;
  finalLetter: Letter;
  formattedFinalGpa?: string;
  /** Active threshold preset, shown on the header's right rail. */
  presetLabel?: string;
}

/**
 * The spec's `.gp` — a round grade mark, not a lozenge. At a fixed 21px it
 * keeps the Grade column an even width whatever letter lands in it.
 */
function GradePill({ grade, small }: { grade: Letter; small?: boolean }) {
  const color = getGradeColor(grade);
  return (
    <span
      data-grade-pill
      data-grade={grade}
      aria-label={`Grade ${grade}`}
      className={`inline-grid place-items-center rounded-full font-mono font-bold tabular-nums ${
        small ? "size-[19px] text-[10px]" : "size-[21px] text-[11px]"
      }`}
      style={{ background: color.bg, color: color.fg }}
    >
      {grade}
    </span>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className="ml-1 inline-block"
    >
      <path
        d={up ? "M5 2 L9 8 L1 8 Z" : "M5 8 L9 2 L1 2 Z"}
        fill="currentColor"
      />
    </svg>
  );
}

const TH =
  "px-2.5 py-2.5 text-[9.5px] font-bold uppercase tracking-[0.09em] text-piq-muted whitespace-nowrap border-b border-piq-line";
const TD =
  "px-2.5 py-2.5 font-mono tabular-nums text-piq-ink whitespace-nowrap";

/**
 * How the grade was built, metric by metric.
 *
 * The contribution column used to carry a small progress bar beside each
 * number. Paired at half width beside the levers it was ~44px of bar competing
 * with the figure it duplicated, and the ratio it encoded (contribution over
 * its own weight cap) is not a quantity anyone reads across rows. The number
 * stays; the bar is gone.
 */
export function ScoreBreakdownTable({
  metrics,
  rawGpa,
  marketAdjustment,
  finalGpa,
  finalLetter,
  formattedFinalGpa,
  presetLabel,
}: ScoreBreakdownTableProps) {
  const finalDisplay = formattedFinalGpa ?? finalGpa.toFixed(2);
  const adjSign = marketAdjustment >= 0 ? "+" : "";

  return (
    <PiqCard>
      <div data-score-breakdown-table>
        <PiqCardHeader
          icon={<BarChart3 size={13} strokeWidth={2} aria-hidden />}
          tone="violet"
          title="How the grade is built"
          label={presetLabel}
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={`${TH} pl-4 text-left`}>Metric</th>
                <th className={`${TH} text-right`}>Deal</th>
                <th className={`${TH} text-center`}>Grade</th>
                <th className={`${TH} text-right`}>Wt</th>
                <th className={`${TH} pr-4 text-right`}>Contrib.</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr
                  key={m.key}
                  data-metric-row
                  data-metric-key={m.key}
                  className="border-b border-piq-soft transition-colors hover:bg-piq-canvas"
                >
                  <td className="whitespace-normal py-2.5 pl-4 pr-2.5 text-left text-piq-body">
                    <span className="inline-flex items-center">
                      {m.label}
                      <MetricHelpButton
                        help={getMetricHelp(m.key)}
                        metricLabel={m.label}
                      />
                    </span>
                  </td>
                  <td className={`${TD} text-right`}>{m.formattedValue}</td>
                  <td className={`${TD} text-center`}>
                    <GradePill grade={m.grade} />
                  </td>
                  <td className={`${TD} text-right`}>{m.weight}%</td>
                  <td className={`${TD} pr-4 text-right`}>
                    {m.contribution.toFixed(2)}
                  </td>
                </tr>
              ))}

              <tr data-footer-row="raw-gpa" className="bg-piq-canvas font-bold">
                <td className="py-2.5 pl-4 pr-2.5 text-left text-piq-ink">
                  Raw GPA
                </td>
                <td colSpan={3} />
                <td className={`${TD} pr-4 text-right font-bold`}>
                  {rawGpa.toFixed(2)}
                </td>
              </tr>

              {/* The market adjustment is the one row whose value is not the
                  deal's own doing, so it carries the caution tone rather than
                  sitting in the ink ramp with the metrics above it. */}
              <tr
                data-footer-row="market-adj"
                className="border-b border-piq-soft"
              >
                <td className="py-2.5 pl-4 pr-2.5 text-left text-piq-amber">
                  Market adjustment
                </td>
                <td colSpan={3} />
                <td
                  className={`${TD} pr-4 text-right`}
                  style={{ color: "var(--piq-amber)" }}
                >
                  <span className="inline-flex items-center justify-end">
                    {adjSign}
                    {marketAdjustment.toFixed(2)}
                    {marketAdjustment !== 0 && (
                      <ChevronIcon up={marketAdjustment > 0} />
                    )}
                  </span>
                </td>
              </tr>

              <tr data-footer-row="final-gpa" className="bg-piq-canvas">
                <td className="py-2.5 pl-4 pr-2.5 text-left font-bold text-piq-ink">
                  Final GPA
                </td>
                <td colSpan={3} />
                <td className={`${TD} pr-4 text-right font-bold`}>
                  <span className="inline-flex items-center justify-end gap-2">
                    {finalDisplay}
                    <GradePill grade={finalLetter} />
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </PiqCard>
  );
}
