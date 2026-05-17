"use client";

/**
 * WeightsTab — five numeric inputs, one per metric. Live sum indicator
 * underneath turns green at 100 (±0.01) and red with a delta hint
 * otherwise. The sum is computed in the parent via `validateWeights`
 * and surfaced here as `sum` + `isValid` props (no fetching done here).
 */

import type { UserThresholds } from "@propertyiq/analyzer-core";
import { METRIC_ROWS } from "./preset-helpers";

type Weights = UserThresholds["weights"];

interface WeightsTabProps {
  weights: Weights;
  onChange: (next: Weights) => void;
  sum: number;
  isValid: boolean;
}

export function WeightsTab({
  weights,
  onChange,
  sum,
  isValid,
}: WeightsTabProps) {
  const delta = 100 - sum;
  const deltaLabel =
    delta === 0
      ? ""
      : delta > 0
        ? `need +${delta.toFixed(2)}`
        : `over by ${Math.abs(delta).toFixed(2)}`;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-on-surface-variant">
        How much each metric contributes to the overall grade. Must sum to 100.
      </p>
      <div className="flex flex-col gap-3">
        {METRIC_ROWS.map((row) => (
          <div
            key={row.key}
            data-testid={`weight-row-${row.key}`}
            className="flex items-center justify-between gap-3"
          >
            <label
              htmlFor={`weight-${row.key}`}
              className="text-sm text-on-surface flex-1"
            >
              {row.label}
            </label>
            <div className="relative w-24">
              <input
                id={`weight-${row.key}`}
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                max={100}
                value={weights[row.key]}
                onChange={(e) => {
                  const raw = parseFloat(e.target.value);
                  onChange({
                    ...weights,
                    [row.key]: Number.isNaN(raw) ? 0 : raw,
                  });
                }}
                aria-label={`${row.label} weight`}
                className="w-full font-mono tabular-nums text-sm bg-surface-container rounded-md px-2 py-1.5 border border-outline-variant focus:outline-none focus:ring-2 focus:ring-[var(--md-primary)]"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant pointer-events-none">
                %
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-outline-variant/60">
        <span
          role="status"
          data-testid="weights-sum-indicator"
          className={
            isValid
              ? "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-[color-mix(in_oklab,var(--md-tertiary)_8%,transparent)] text-[var(--md-tertiary)] border border-[var(--md-tertiary)]/30"
              : "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-[color-mix(in_oklab,var(--md-error)_8%,transparent)] text-[var(--md-error)] border border-[var(--md-error)]/30"
          }
        >
          Sum: <span className="font-mono tabular-nums">{sum.toFixed(2)}</span>
          {isValid ? " ✓" : ` (${deltaLabel})`}
        </span>
      </div>
    </div>
  );
}
