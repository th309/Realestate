"use client";

import type { Letter, MetricResult } from "@propertyiq/analyzer-core";
import { getGradeColor } from "../../lib/grade-colors";

interface ScoreBreakdownTableProps {
  metrics: MetricResult[];
  rawGpa: number;
  marketAdjustment: number;
  finalGpa: number;
  finalLetter: Letter;
  formattedFinalGpa?: string;
}

function GradePill({ grade }: { grade: Letter }) {
  const color = getGradeColor(grade);
  return (
    <span
      data-grade-pill
      data-grade={grade}
      aria-label={`Grade ${grade}`}
      className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums"
      style={{ background: color.bg, color: color.fg }}
    >
      {grade}
    </span>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 16 16"
      className="inline-block ml-1 text-on-surface-variant/60"
    >
      <circle
        cx="8"
        cy="8"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <text
        x="8"
        y="11.5"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="currentColor"
      >
        ?
      </text>
    </svg>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className="inline-block ml-1"
    >
      <path
        d={up ? "M5 2 L9 8 L1 8 Z" : "M5 8 L9 2 L1 2 Z"}
        fill="currentColor"
      />
    </svg>
  );
}

export function ScoreBreakdownTable({
  metrics,
  rawGpa,
  marketAdjustment,
  finalGpa,
  finalLetter,
  formattedFinalGpa,
}: ScoreBreakdownTableProps) {
  const finalDisplay = formattedFinalGpa ?? finalGpa.toFixed(2);
  const adjSign = marketAdjustment >= 0 ? "+" : "";

  return (
    <div
      data-score-breakdown-table
      className="rounded-2xl border border-outline-variant bg-surface overflow-hidden"
    >
      <table className="w-full text-sm">
        <thead>
          <tr
            className="text-xs uppercase tracking-wide text-on-surface-variant"
            style={{ borderBottom: "1.75px solid var(--md-outline-variant)" }}
          >
            <th className="text-left font-medium px-4 py-3">Metric</th>
            <th className="text-right font-medium px-4 py-3">Your Deal</th>
            <th className="text-center font-medium px-4 py-3">Grade</th>
            <th className="text-right font-medium px-4 py-3">Weight</th>
            <th className="text-right font-medium px-4 py-3">Contribution</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, idx) => {
            const color = getGradeColor(m.grade);
            const maxContribution = (m.weight / 100) * 4;
            const ratio =
              maxContribution > 0
                ? Math.min(1, Math.max(0, m.contribution / maxContribution))
                : 0;
            return (
              <tr
                key={m.key}
                data-metric-row
                data-metric-key={m.key}
                className={`hover:bg-surface-container-low transition-colors hover:[transform:translateY(-1px)] ${
                  idx === metrics.length - 1
                    ? ""
                    : "border-b border-outline-variant"
                }`}
              >
                <td className="px-4 py-3 text-on-surface">
                  <span className="inline-flex items-center">
                    {m.label}
                    <InfoIcon />
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-on-surface font-mono">
                  {m.formattedValue}
                </td>
                <td className="px-4 py-3 text-center">
                  <GradePill grade={m.grade} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">
                  {m.weight}%
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center justify-end gap-2">
                    <span className="tabular-nums font-mono text-on-surface">
                      {m.contribution.toFixed(2)}
                    </span>
                    <span
                      aria-hidden
                      className="inline-block h-1.5 rounded-full bg-outline-variant overflow-hidden"
                      style={{ width: 60 }}
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${ratio * 100}%`,
                          background: color.fg,
                        }}
                      />
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot style={{ borderTop: "1.75px solid var(--md-outline-variant)" }}>
          <tr data-footer-row="raw-gpa">
            <td
              colSpan={4}
              className="px-4 py-2 text-right text-on-surface-variant"
            >
              Raw GPA
            </td>
            <td className="px-4 py-2 text-right tabular-nums font-mono text-on-surface">
              {rawGpa.toFixed(2)}
            </td>
          </tr>
          <tr data-footer-row="market-adj">
            <td
              colSpan={4}
              className="px-4 py-2 text-right text-on-surface-variant"
            >
              Market adjustment
            </td>
            <td className="px-4 py-2 text-right tabular-nums font-mono text-on-surface">
              <span className="inline-flex items-center justify-end">
                {adjSign}
                {marketAdjustment.toFixed(2)}
                {marketAdjustment !== 0 && (
                  <ChevronIcon up={marketAdjustment > 0} />
                )}
              </span>
            </td>
          </tr>
          <tr data-footer-row="final-gpa">
            <td
              colSpan={4}
              className="px-4 py-2 text-right text-on-surface font-semibold"
            >
              Final GPA
            </td>
            <td className="px-4 py-2 text-right">
              <span className="inline-flex items-center justify-end gap-2 tabular-nums font-mono font-bold text-on-surface">
                {finalDisplay}
                <GradePill grade={finalLetter} />
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
