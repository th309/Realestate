"use client";

/**
 * BRRRR upgrade-path panel — per-metric attribution.
 *
 * Renders one section per non-A metric showing the smallest lever moves that
 * lift that metric to its next grade tier. Same UX model as the B&H
 * UpgradePathPanel, BRRRR-specific lever set (7 levers).
 *
 * Each apply routes through the parent's onApplyBrrrrLever callback since
 * BRRRR state is split across analyzer.input, arvLocal, rehabBudget, and
 * assumptions.
 */
import { useMemo } from "react";
import type {
  BrrrrPerMetricUpgrade,
  BrrrrThresholds,
  BrrrrUpgradeOption,
  Letter,
} from "@propertyiq/analyzer-core";
import { useUpgradePathBrrrr, type UpgradePathBrrrrRequest } from "@/lib/data";
import { BrrrrUpgradePathOption } from "./BrrrrUpgradePathOption";
import { getGradeColor } from "../../lib/grade-colors";

interface BrrrrUpgradePathPanelProps {
  input: UpgradePathBrrrrRequest["input"];
  context?: UpgradePathBrrrrRequest["context"];
  currentGrade: Letter;
  onApplyBrrrrLever: (option: BrrrrUpgradeOption) => void;
  overrideThresholds?: BrrrrThresholds;
}

const NEXT: Record<Letter, Letter> = {
  F: "D",
  D: "C",
  C: "B",
  B: "A",
  A: "A",
};

export function BrrrrUpgradePathPanel({
  input,
  context,
  currentGrade,
  onApplyBrrrrLever,
  overrideThresholds,
}: BrrrrUpgradePathPanelProps) {
  const payload: UpgradePathBrrrrRequest | null = useMemo(() => {
    if (currentGrade === "A") return null;
    return {
      input,
      context,
      targetGrade: NEXT[currentGrade],
      overrideThresholds,
    };
  }, [input, context, currentGrade, overrideThresholds]);

  const { data, isLoading, isError, error } = useUpgradePathBrrrr(payload, {
    enabled: payload !== null,
  });

  if (currentGrade === "A") return null;

  const perMetric = data?.perMetric ?? [];

  return (
    <div
      data-brrrr-upgrade-path-panel
      className="rounded-2xl border border-outline-variant bg-surface p-6 space-y-5"
    >
      <div className="space-y-1">
        <h3
          className="text-xl font-semibold text-on-surface"
          style={{ fontFamily: "var(--font-source-serif)" }}
        >
          What&apos;s holding this BRRRR back
        </h3>
        <p className="text-sm text-on-surface-variant">
          Each metric below feeds into your overall grade. Pick a lever to lift
          that specific metric to its next tier.
        </p>
      </div>

      {isLoading && (
        <div data-upgrade-loading className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[160px] rounded-xl bg-surface-variant/40 animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      )}

      {isError && (
        <div
          data-upgrade-error
          role="alert"
          className="rounded-xl border-2 border-[var(--md-error)] bg-[var(--md-error-container)] text-[var(--md-on-error-container)] px-4 py-3 text-sm"
        >
          <strong>Couldn&apos;t compute upgrade path:</strong>{" "}
          {error?.message ?? "unknown error"}
        </div>
      )}

      {data && perMetric.length === 0 && (
        <div
          data-upgrade-all-clear
          className="rounded-xl border border-outline-variant bg-surface-variant/30 p-4 text-sm text-on-surface-variant"
        >
          All metrics are grading A. No upgrades needed.
        </div>
      )}

      {data &&
        perMetric.length > 0 &&
        perMetric.map((entry) => (
          <BrrrrPerMetricSection
            key={entry.metricKey}
            entry={entry}
            onApply={onApplyBrrrrLever}
          />
        ))}
    </div>
  );
}

interface BrrrrPerMetricSectionProps {
  entry: BrrrrPerMetricUpgrade;
  onApply: (option: BrrrrUpgradeOption) => void;
}

function BrrrrPerMetricSection({ entry, onApply }: BrrrrPerMetricSectionProps) {
  const currentColor = getGradeColor(entry.currentGrade);
  const targetColor = getGradeColor(entry.targetGrade);

  return (
    <section
      data-upgrade-metric={entry.metricKey}
      className="rounded-xl border border-outline-variant bg-surface-variant/20 p-4 space-y-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-base font-semibold text-on-surface leading-tight">
            {entry.metricLabel}
          </h4>
          <p className="mt-0.5 text-xs text-on-surface-variant tabular-nums">
            Currently {entry.formattedValue}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <GradeChip letter={entry.currentGrade} color={currentColor} />
          <span aria-hidden className="text-on-surface-variant">
            →
          </span>
          <GradeChip letter={entry.targetGrade} color={targetColor} />
        </div>
      </header>

      {entry.options.length === 0 ? (
        <p
          data-upgrade-metric-unreachable
          className="text-xs text-on-surface-variant italic"
        >
          No single lever (within reasonable bounds) lifts this metric to{" "}
          {entry.targetGrade}. Combine multiple changes or adjust the rubric.
        </p>
      ) : (
        <div data-upgrade-metric-options className="space-y-2">
          {entry.options.map((option, idx) => (
            <BrrrrUpgradePathOption
              key={`${entry.metricKey}-${option.lever}-${option.targetValue}`}
              option={option}
              index={idx}
              onApply={() => onApply(option)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface GradeChipProps {
  letter: Letter;
  color: { fg: string; bg: string };
}

function GradeChip({ letter, color }: GradeChipProps) {
  return (
    <span
      aria-label={`Grade ${letter}`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold tabular-nums"
      style={{ color: color.fg, background: color.bg }}
    >
      {letter}
    </span>
  );
}
