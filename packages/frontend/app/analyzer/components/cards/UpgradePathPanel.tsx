"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
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

interface UpgradePathPanelProps {
  input: DealInput;
  context: GradingContext;
  currentGrade: Letter;
  strategy: Strategy;
  onApply: (next: DealInput) => void;
  overrideThresholds?: UserThresholds;
}

const LETTER_RANK: Record<Letter, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 };
const LETTERS: Letter[] = ["A", "B", "C", "D", "F"];

/** Targets strictly better than the current letter (higher rank = better). */
function targetsAbove(currentGrade: Letter): Letter[] {
  const cur = LETTER_RANK[currentGrade];
  return LETTERS.filter((l) => LETTER_RANK[l] > cur).sort(
    (a, b) => LETTER_RANK[a] - LETTER_RANK[b],
  );
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

/**
 * Attempt to parse a combination hint like
 * "drop price by $15,000 and raise rent by $200/mo" into concrete deltas.
 * Returns null if either delta is missing — caller hides the Apply button.
 */
function parseCombinationHint(
  hint: string,
): { priceDelta: number; rentDelta: number } | null {
  const priceMatch = hint.match(/price[^$]*\$([\d,]+)/i);
  const rentMatch = hint.match(/rent[^$]*\$([\d,]+)/i);
  if (!priceMatch || !rentMatch) return null;
  const priceDelta = -Math.abs(Number(priceMatch[1].replace(/,/g, "")));
  const rentDelta = Math.abs(Number(rentMatch[1].replace(/,/g, "")));
  if (!Number.isFinite(priceDelta) || !Number.isFinite(rentDelta)) return null;
  return { priceDelta, rentDelta };
}

export function UpgradePathPanel({
  input,
  context,
  currentGrade,
  strategy,
  onApply,
  overrideThresholds,
}: UpgradePathPanelProps) {
  // Safety belt — caller should also gate. Compute hooks first to keep hook
  // order stable across renders (currentGrade is a prop, not state).
  const available = useMemo(() => targetsAbove(currentGrade), [currentGrade]);
  const [targetGrade, setTargetGrade] = useState<Letter>(
    available[0] ?? ("A" as Letter),
  );

  // If the current grade changes and the previously-selected target is no
  // longer reachable (e.g. it became the current grade), snap to next-up.
  // Note: simple resolution — render the first valid available target if
  // the chosen one fell out of the list.
  const effectiveTarget: Letter = available.includes(targetGrade)
    ? targetGrade
    : (available[0] ?? ("A" as Letter));

  const payload: UpgradePathRequest | null = useMemo(() => {
    if (currentGrade === "A") return null;
    return {
      strategy,
      input,
      context,
      targetGrade: effectiveTarget,
      overrideThresholds,
    };
  }, [
    strategy,
    input,
    context,
    effectiveTarget,
    overrideThresholds,
    currentGrade,
  ]);

  const { data, isLoading, isError, error } = useUpgradePath(payload, {
    enabled: payload !== null,
  });

  if (currentGrade === "A") return null;

  const combinationParse =
    data && !data.achievable && data.combinationHint
      ? parseCombinationHint(data.combinationHint)
      : null;

  return (
    <div
      data-upgrade-path-panel
      className="rounded-2xl border border-outline-variant bg-surface p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3
          className="text-xl font-semibold text-on-surface"
          style={{ fontFamily: "var(--font-source-serif)" }}
        >
          How to upgrade to {effectiveTarget}
        </h3>
        <label className="text-xs text-on-surface-variant flex items-center gap-2">
          <span>Target grade</span>
          <select
            data-upgrade-target-select
            value={effectiveTarget}
            onChange={(e) => setTargetGrade(e.target.value as Letter)}
            className="rounded-full border border-outline bg-surface px-3 py-1 text-sm text-on-surface tabular-nums"
          >
            {available.map((letter) => (
              <option key={letter} value={letter}>
                {letter}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && (
        <div data-upgrade-loading className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[72px] rounded-xl bg-surface-variant/40 animate-pulse"
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
          <strong>Couldn’t compute upgrade path:</strong>{" "}
          {error?.message ?? "unknown error"}
        </div>
      )}

      {data && data.achievable && data.options.length > 0 && (
        <div data-upgrade-options className="space-y-2">
          {data.options.map((option, idx) => (
            <UpgradePathOption
              key={`${option.lever}-${option.targetValue}`}
              option={option}
              index={idx}
              onApply={() => onApply(applyLever(input, option))}
            />
          ))}
        </div>
      )}

      {data && !data.achievable && data.combinationHint && (
        <div
          data-upgrade-combination
          className="rounded-xl border border-outline-variant bg-surface-variant/30 p-4 flex items-start gap-3"
        >
          <ChevronRight
            size={18}
            className="mt-0.5 shrink-0 text-on-surface-variant"
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-on-surface leading-snug">
              {data.combinationHint}
            </p>
            {combinationParse && (
              <button
                type="button"
                data-upgrade-apply-combination
                onClick={() =>
                  onApply({
                    ...input,
                    price: input.price + combinationParse.priceDelta,
                    rentMonthly:
                      (input.rentMonthly ?? 0) + combinationParse.rentDelta,
                  })
                }
                className="mt-2 rounded-full border border-outline px-4 py-1.5 text-xs font-medium text-primary hover:bg-primary-container/40 transition-colors duration-200"
              >
                Apply combination
              </button>
            )}
          </div>
        </div>
      )}

      {data && !data.achievable && !data.combinationHint && (
        <div
          data-upgrade-unreachable
          className="rounded-xl border border-outline-variant bg-surface-variant/30 p-4 text-sm text-on-surface-variant"
        >
          No single lever reaches {effectiveTarget} from here. Try a lower
          target grade.
        </div>
      )}
    </div>
  );
}
