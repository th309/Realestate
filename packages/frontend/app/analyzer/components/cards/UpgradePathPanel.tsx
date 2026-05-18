"use client";

import { useMemo } from "react";
import type {
  DealInput,
  GradingContext,
  Letter,
  PerMetricUpgrade,
  Strategy,
  UpgradePathOption as UpgradePathOptionType,
  UserThresholds,
} from "@propertyiq/analyzer-core";
import { useUpgradePath, type UpgradePathRequest } from "@/lib/data";
import { UpgradePathOption } from "./UpgradePathOption";
import { getGradeColor } from "../../lib/grade-colors";

interface UpgradePathPanelProps {
  input: DealInput;
  context: GradingContext;
  currentGrade: Letter;
  strategy: Strategy;
  onApply: (next: DealInput) => void;
  overrideThresholds?: UserThresholds;
}

/**
 * Map an applied lever option back onto the DealInput shape. `downPayment`
 * is stored on the lever in DOLLARS but on DealInput as a decimal fraction
 * of price, so we convert here.
 */
export function applyLever(
  input: DealInput,
  option: UpgradePathOptionType,
): DealInput {
  switch (option.lever) {
    case "purchasePrice":
      return { ...input, price: option.targetValue };
    case "monthlyRent":
      return { ...input, rentMonthly: option.targetValue };
    case "downPayment":
      return {
        ...input,
        financing: {
          ...input.financing,
          downPaymentPct:
            input.price > 0 ? option.targetValue / input.price : 0,
        },
      };
    case "interestRate":
      return {
        ...input,
        financing: { ...input.financing, interestRatePct: option.targetValue },
      };
    default:
      return input;
  }
}

export function UpgradePathPanel({
  input,
  context,
  currentGrade,
  strategy,
  onApply,
  overrideThresholds,
}: UpgradePathPanelProps) {
  // We always ask for "next tier" as the overall target — but the meaningful
  // payload here is the per-metric breakdown the engine returns alongside.
  const payload: UpgradePathRequest | null = useMemo(() => {
    if (currentGrade === "A") return null;
    const NEXT: Record<Letter, Letter> = {
      F: "D",
      D: "C",
      C: "B",
      B: "A",
      A: "A",
    };
    return {
      strategy,
      input,
      context,
      targetGrade: NEXT[currentGrade],
      overrideThresholds,
    };
  }, [strategy, input, context, currentGrade, overrideThresholds]);

  const { data, isLoading, isError, error } = useUpgradePath(payload, {
    enabled: payload !== null,
  });

  if (currentGrade === "A") return null;

  const perMetric = data?.perMetric ?? [];

  return (
    <div
      data-upgrade-path-panel
      className="rounded-2xl border border-outline-variant bg-surface p-6 space-y-5"
    >
      <div className="space-y-1">
        <h3
          className="text-xl font-semibold text-on-surface"
          style={{ fontFamily: "var(--font-source-serif)" }}
        >
          What&apos;s holding this deal back
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
          <PerMetricSection
            key={entry.metricKey}
            entry={entry}
            input={input}
            onApply={onApply}
          />
        ))}
    </div>
  );
}

interface PerMetricSectionProps {
  entry: PerMetricUpgrade;
  input: DealInput;
  onApply: (next: DealInput) => void;
}

function PerMetricSection({ entry, input, onApply }: PerMetricSectionProps) {
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
            <UpgradePathOption
              key={`${entry.metricKey}-${option.lever}-${option.targetValue}`}
              option={option}
              index={idx}
              onApply={() => onApply(applyLever(input, option))}
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
