"use client";

/**
 * Fix & Flip upgrade-path panel — per-metric attribution.
 *
 * Renders one section per non-A metric showing the smallest lever moves that
 * lift that metric to its next grade tier. F&F-native lever set (5 levers):
 * purchasePrice, arv, rehabCost, holdMonths, financingRate.
 *
 * Each apply routes through the parent's onApplyFlipLever callback because
 * F&F state is split across analyzer.input, arvLocal, rehabBudget, and
 * assumptions.
 */
import { useMemo } from "react";
import type {
  FixAndFlipThresholds,
  FlipUpgradeOption,
  Letter,
} from "@propertyiq/analyzer-core";
import { useUpgradePathFlip, type UpgradePathFlipRequest } from "@/lib/data";
import { FlipUpgradePathOption } from "./FlipUpgradePathOption";
import { UpgradeMetricRow, UpgradePathShell } from "./upgrade-path";

interface FlipUpgradePathPanelProps {
  input: UpgradePathFlipRequest["input"];
  context?: UpgradePathFlipRequest["context"];
  currentGrade: Letter;
  onApplyFlipLever: (option: FlipUpgradeOption) => void;
  overrideThresholds?: FixAndFlipThresholds;
}

const NEXT: Record<Letter, Letter> = {
  F: "D",
  D: "C",
  C: "B",
  B: "A",
  A: "A",
};

export function FlipUpgradePathPanel({
  input,
  context,
  currentGrade,
  onApplyFlipLever,
  overrideThresholds,
}: FlipUpgradePathPanelProps) {
  const payload: UpgradePathFlipRequest | null = useMemo(() => {
    if (currentGrade === "A") return null;
    return {
      input,
      context,
      targetGrade: NEXT[currentGrade],
      overrideThresholds,
    };
  }, [input, context, currentGrade, overrideThresholds]);

  const { data, isLoading, isError, error } = useUpgradePathFlip(payload, {
    enabled: payload !== null,
  });

  if (currentGrade === "A") return null;

  const perMetric = data?.perMetric ?? [];

  return (
    <UpgradePathShell
      dataAttribute="data-flip-upgrade-path-panel"
      title="What would lift this flip"
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
                <FlipUpgradePathOption
                  key={`${entry.metricKey}-${option.lever}-${option.targetValue}`}
                  option={option}
                  index={idx}
                  onApply={() => onApplyFlipLever(option)}
                />
              ))}
            </div>
          )}
        </UpgradeMetricRow>
      ))}
    </UpgradePathShell>
  );
}
