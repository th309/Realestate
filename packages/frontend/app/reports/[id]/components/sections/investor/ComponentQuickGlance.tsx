"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

import {
  getScoreStrokeColor,
  formatComponentLabel,
} from "../../utils/scoreHelpers";

interface ComponentScore {
  component: string;
  score: number;
  status?: string;
}

interface ComponentQuickGlanceProps {
  components: ComponentScore[];
}

const GAP_THRESHOLD = 40;

/**
 * Renders all score components as compact pills with an optional
 * tension callout when the gap between best and worst is large.
 */
export function ComponentQuickGlance({
  components,
}: ComponentQuickGlanceProps): React.ReactElement {
  const sorted = [...components].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const gap = best && worst ? Math.round(best.score - worst.score) : 0;

  return (
    <div className="mb-[var(--report-space-lg)] report-animate-in report-animate-in-delay-2">
      <div className="flex flex-wrap justify-center gap-3">
        {sorted.map((comp) => (
          <div
            key={comp.component}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--report-radius-md)]"
            style={{
              backgroundColor: "white",
              border: "1px solid rgba(27, 46, 74, 0.06)",
            }}
          >
            <span
              className="text-sm font-semibold"
              style={{
                color: getScoreStrokeColor(comp.score),
                fontFamily: "var(--report-font-display)",
              }}
            >
              {Math.round(comp.score)}
            </span>
            <span
              className="text-xs font-medium"
              style={{
                color: "var(--report-stone)",
                fontFamily: "var(--report-font-body)",
              }}
            >
              {formatComponentLabel(comp.component)}
            </span>
          </div>
        ))}
      </div>
      {gap >= GAP_THRESHOLD && best && worst && (
        <div
          className="flex items-center justify-center gap-2 mt-3 px-4 py-2 rounded-[var(--report-radius-md)] text-xs"
          style={{
            backgroundColor: "var(--report-warning-bg)",
            color: "var(--report-warning)",
            fontFamily: "var(--report-font-body)",
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            {formatComponentLabel(best.component)} ({Math.round(best.score)}) vs{" "}
            {formatComponentLabel(worst.component)} ({Math.round(worst.score)})
            — {gap}-point gap. See analysis below for details.
          </span>
        </div>
      )}
    </div>
  );
}

export default ComponentQuickGlance;
