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
  BrrrrThresholds,
  BrrrrUpgradeOption,
  Letter,
} from "@propertyiq/analyzer-core";
import { useUpgradePathBrrrr, type UpgradePathBrrrrRequest } from "@/lib/data";
import { BrrrrUpgradePathOption } from "./BrrrrUpgradePathOption";
import { UpgradeMetricRow, UpgradePathShell } from "./upgrade-path";

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
    <UpgradePathShell
      dataAttribute="data-brrrr-upgrade-path-panel"
      title="What would lift this BRRRR"
      isLoading={isLoading}
      isError={isError}
      errorMessage={error?.message}
      isAllClear={Boolean(data) && perMetric.length === 0}
    >
      {perMetric.map((entry) => (
        <UpgradeMetricRow
          key={entry.metricKey}
          metricKey={entry.metricKey}
          metricLabel={entry.metricLabel}
          formattedValue={entry.formattedValue}
          currentGrade={entry.currentGrade}
          targetGrade={entry.targetGrade}
        >
          {entry.options.length === 0 ? null : (
            <div data-upgrade-metric-options className="space-y-2">
              {entry.options.map((option, idx) => (
                <BrrrrUpgradePathOption
                  key={`${entry.metricKey}-${option.lever}-${option.targetValue}`}
                  option={option}
                  index={idx}
                  onApply={() => onApplyBrrrrLever(option)}
                />
              ))}
            </div>
          )}
        </UpgradeMetricRow>
      ))}
    </UpgradePathShell>
  );
}
