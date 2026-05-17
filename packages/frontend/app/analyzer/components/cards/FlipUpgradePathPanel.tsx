"use client";

/**
 * Fix & Flip upgrade-path panel.
 *
 * F&F-native — NOT a copy of UpgradePathPanel. Distinctions:
 *
 *   1. Calls /api/analyzer/upgrade-path-flip (not /upgrade-path)
 *   2. Lever set: purchasePrice, arv, rehabCost, holdMonths, financingRate
 *      — different from B&H's purchase/rent/downPayment/rate
 *   3. Labels and combination hints come from the F&F engine ("Improve ARV
 *      with strict comps", "Reduce rehab cost", "Shorten hold period",
 *      "Get a better financing rate") — flipper vocabulary, not analyst
 *   4. Each lever apply routes to a DIFFERENT analyzer state setter
 *      because F&F state is split (price in analyzer.input, ARV in arvLocal,
 *      rehab in rehabBudget, hold in assumptions, rate in financing) —
 *      parent owns the mapping via onApplyFlipLever callback
 */
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type {
  FixAndFlipThresholds,
  FlipUpgradeOption,
  Letter,
} from "@propertyiq/analyzer-core";
import { useUpgradePathFlip, type UpgradePathFlipRequest } from "@/lib/data";
import { FlipUpgradePathOption } from "./FlipUpgradePathOption";

interface FlipUpgradePathPanelProps {
  /** API-shape F&F input (same shape useGradeFlipDeal accepts). */
  input: UpgradePathFlipRequest["input"];
  context?: UpgradePathFlipRequest["context"];
  currentGrade: Letter;
  /** Apply a single lever's recommended target value back to analyzer state. */
  onApplyFlipLever: (option: FlipUpgradeOption) => void;
  /** Apply the combination-hint move (price reduction + rehab reduction). */
  onApplyFlipCombination?: (combo: {
    priceDelta: number;
    rehabDelta: number;
  }) => void;
  overrideThresholds?: FixAndFlipThresholds;
}

const LETTER_RANK: Record<Letter, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 };
const LETTERS: Letter[] = ["A", "B", "C", "D", "F"];

function targetsAbove(currentGrade: Letter): Letter[] {
  const cur = LETTER_RANK[currentGrade];
  return LETTERS.filter((l) => LETTER_RANK[l] > cur).sort(
    (a, b) => LETTER_RANK[a] - LETTER_RANK[b],
  );
}

/**
 * Parse the F&F combination hint into concrete deltas. The engine produces:
 *   "Combination needed: reduce price by ~$X AND trim rehab by ~$Y"
 */
function parseFlipCombinationHint(
  hint: string,
): { priceDelta: number; rehabDelta: number } | null {
  const priceMatch = hint.match(/price[^$]*\$([\d,]+)/i);
  const rehabMatch = hint.match(/rehab[^$]*\$([\d,]+)/i);
  if (!priceMatch || !rehabMatch) return null;
  const priceDelta = -Math.abs(Number(priceMatch[1].replace(/,/g, "")));
  const rehabDelta = -Math.abs(Number(rehabMatch[1].replace(/,/g, "")));
  if (!Number.isFinite(priceDelta) || !Number.isFinite(rehabDelta)) return null;
  return { priceDelta, rehabDelta };
}

export function FlipUpgradePathPanel({
  input,
  context,
  currentGrade,
  onApplyFlipLever,
  onApplyFlipCombination,
  overrideThresholds,
}: FlipUpgradePathPanelProps) {
  const available = useMemo(() => targetsAbove(currentGrade), [currentGrade]);
  const [targetGrade, setTargetGrade] = useState<Letter>(
    available[0] ?? ("A" as Letter),
  );

  const effectiveTarget: Letter = available.includes(targetGrade)
    ? targetGrade
    : (available[0] ?? ("A" as Letter));

  const payload: UpgradePathFlipRequest | null = useMemo(() => {
    if (currentGrade === "A") return null;
    return {
      input,
      context,
      targetGrade: effectiveTarget,
      overrideThresholds,
    };
  }, [input, context, effectiveTarget, overrideThresholds, currentGrade]);

  const { data, isLoading, isError, error } = useUpgradePathFlip(payload, {
    enabled: payload !== null,
  });

  if (currentGrade === "A") return null;

  const combinationParse =
    data && !data.achievable && data.combinationHint
      ? parseFlipCombinationHint(data.combinationHint)
      : null;

  return (
    <div
      data-flip-upgrade-path-panel
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
            <FlipUpgradePathOption
              key={`${option.lever}-${option.targetValue}`}
              option={option}
              index={idx}
              onApply={() => onApplyFlipLever(option)}
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
            {combinationParse && onApplyFlipCombination && (
              <button
                type="button"
                data-upgrade-apply-combination
                onClick={() => onApplyFlipCombination(combinationParse)}
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
