"use client";

import { useMemo } from "react";
import type {
  DealInput,
  GradingContext,
  Letter,
  Strategy,
  UpgradePathOption as UpgradePathOptionType,
  UserThresholds,
} from "@propertyiq/analyzer-core";
import { useUpgradePath, type UpgradePathRequest } from "@/lib/data";
import { UpgradePathOption } from "./UpgradePathOption";
import { UpgradeMetricRow, UpgradePathShell } from "./upgrade-path";

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
    <UpgradePathShell
      dataAttribute="data-upgrade-path-panel"
      title="What would lift the grade"
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
                <UpgradePathOption
                  key={`${entry.metricKey}-${option.lever}-${option.targetValue}`}
                  option={option}
                  index={idx}
                  onApply={() => onApply(applyLever(input, option))}
                />
              ))}
            </div>
          )}
        </UpgradeMetricRow>
      ))}
    </UpgradePathShell>
  );
}
