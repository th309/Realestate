"use client";

/**
 * AutoKillTab — per-rule enable switch + editable numeric limit for the
 * active strategy's auto-kill rules. Presentation-only: parent owns the
 * thresholds object; edits come back as a fresh object via onChange with
 * the autoKills block merged in (same contract as ThresholdsTab).
 */

import type { Strategy } from "@propertyiq/analyzer-core";
import type { AnyStrategyThresholds } from "./preset-helpers";
import {
  autoKillRowsForStrategy,
  getAutoKillConfig,
  type AutoKillRowMeta,
} from "./autokill-rows";

interface AutoKillTabProps {
  strategy: Strategy;
  thresholds: AnyStrategyThresholds;
  onChange: (next: AnyStrategyThresholds) => void;
  errors: Record<string, string | null>;
}

const toDisplay = (row: AutoKillRowMeta, v: number): number =>
  row.unit === "percent" ? Math.round(v * 1000) / 10 : v;
const fromDisplay = (row: AutoKillRowMeta, v: number): number =>
  row.unit === "percent" ? v / 100 : v;
const suffixFor = (row: AutoKillRowMeta): string =>
  row.unit === "percent"
    ? "%"
    : row.unit === "dollars"
      ? "$"
      : row.unit === "multiplier"
        ? "×"
        : "";

export function AutoKillTab({
  strategy,
  thresholds,
  onChange,
  errors,
}: AutoKillTabProps) {
  const config = getAutoKillConfig(thresholds);

  function patchRule(
    key: string,
    patch: { enabled?: boolean; value?: number },
  ) {
    onChange({
      ...(thresholds as object),
      autoKills: {
        ...config,
        [key]: { ...config[key], ...patch },
      },
    } as unknown as AnyStrategyThresholds);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-on-surface-variant">
        Auto-kill rules force a deal straight to an F grade. Disable a rule or
        tune its limit — saved to your account and applied to every analysis.
      </p>
      {autoKillRowsForStrategy(strategy).map((row) => {
        const rule = config[row.key] ?? {};
        const enabled = rule.enabled ?? true;
        const value = rule.value ?? row.defaultValue;
        const err = errors[row.key];
        return (
          <div
            key={row.key}
            data-testid={`autokill-row-${row.key}`}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-on-surface">
                  {row.label}
                </div>
                <div className="text-[11px] text-on-surface-variant">
                  {row.description}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${row.label} rule`}
                onClick={() => patchRule(row.key, { enabled: !enabled })}
                className={
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 " +
                  (enabled
                    ? "bg-primary"
                    : "bg-surface-container-highest border border-outline-variant")
                }
              >
                <span
                  className={
                    "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-transform duration-200 " +
                    (enabled ? "translate-x-[22px]" : "translate-x-0.5")
                  }
                />
              </button>
            </div>
            {row.unit != null && value != null && (
              <div className="relative w-36">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  disabled={!enabled}
                  value={toDisplay(row, value)}
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value);
                    if (Number.isNaN(raw)) return;
                    patchRule(row.key, { value: fromDisplay(row, raw) });
                  }}
                  aria-label={`${row.label} limit`}
                  className="w-full font-mono tabular-nums text-sm bg-surface-container rounded-md px-2 py-1.5 border border-outline-variant focus:outline-none focus:ring-2 focus:ring-[var(--md-primary)] disabled:opacity-50"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant pointer-events-none">
                  {suffixFor(row)}
                </span>
              </div>
            )}
            {row.defaultValue != null && (
              <div className="text-[11px] text-on-surface-variant">
                Default: {toDisplay(row, row.defaultValue)}
                {suffixFor(row)}
              </div>
            )}
            {err && (
              <div
                role="alert"
                className="text-xs text-[var(--md-error)]"
                data-testid={`autokill-error-${row.key}`}
              >
                {err}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
