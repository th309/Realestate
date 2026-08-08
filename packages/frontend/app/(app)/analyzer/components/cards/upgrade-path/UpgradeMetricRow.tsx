import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { Letter } from "@propertyiq/analyzer-core";
import { getGradeColor } from "../../../lib/grade-colors";
import { GradeChip } from "./GradeChip";

interface UpgradeMetricRowProps {
  metricKey: string;
  metricLabel: string;
  /** The metric's current value, already formatted. */
  formattedValue: string;
  currentGrade: Letter;
  targetGrade: Letter;
  /** Lever options, or null when no single lever reaches the target grade. */
  children: ReactNode | null;
}

/**
 * One failing metric and the levers that would lift it — the spec's `.lev`.
 *
 * Rows are divided by a hairline inside the panel rather than each being its
 * own bordered card. Boxing them put a border and a fill inside a border and a
 * fill, three deep once the lever box landed inside, and the nesting read as
 * hierarchy that isn't there — every metric here is a peer.
 */
export function UpgradeMetricRow({
  metricKey,
  metricLabel,
  formattedValue,
  currentGrade,
  targetGrade,
  children,
}: UpgradeMetricRowProps) {
  return (
    <section
      data-upgrade-metric={metricKey}
      className="border-b border-piq-soft px-4 py-3.5 last:border-b-0"
    >
      <header className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <h4 className="text-[13.5px] font-bold leading-tight tracking-[-0.02em] text-piq-ink">
          {metricLabel}
        </h4>
        <p className="font-mono text-xs tabular-nums text-piq-muted">
          {formattedValue}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <GradeChip
            letter={currentGrade}
            color={getGradeColor(currentGrade)}
          />
          <ArrowRight
            size={12}
            strokeWidth={2}
            aria-hidden
            className="text-piq-muted"
          />
          <GradeChip letter={targetGrade} color={getGradeColor(targetGrade)} />
        </div>
      </header>

      {children ?? (
        <p
          data-upgrade-metric-unreachable
          className="rounded-[10px] border border-dashed border-piq-line bg-piq-canvas px-3 py-2.5 text-xs italic text-piq-muted"
        >
          No single lever (within reasonable bounds) lifts this metric to{" "}
          {targetGrade}. Combine multiple changes or adjust the rubric.
        </p>
      )}
    </section>
  );
}
