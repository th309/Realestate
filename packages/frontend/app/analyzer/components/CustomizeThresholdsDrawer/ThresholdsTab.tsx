"use client";

/**
 * ThresholdsTab — N metric rows × 4 A/B/C/D inputs each. Strategy-aware via
 * the `rows` prop the parent passes in (rowsForStrategy).
 *
 * Presentation-only: it doesn't fetch, save, or own canonical state. Parent
 * owns `thresholds` and gets a fresh object back via `onChange`. Per-row
 * Reset uses the active preset supplied by the parent.
 *
 * Display vs storage conversion lives in MetricRowMeta (see preset-helpers).
 * That keeps inputs human-readable ("12") while the wire format stays
 * decimal (0.12).
 */

import type { MetricThreshold } from "@propertyiq/analyzer-core";
import type { MetricRowMeta, AnyStrategyThresholds } from "./preset-helpers";

interface ThresholdsTabProps {
  rows: MetricRowMeta[];
  thresholds: AnyStrategyThresholds;
  preset: AnyStrategyThresholds;
  onChange: (next: AnyStrategyThresholds) => void;
  errors: Record<string, string | null>;
}

const LETTERS: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];

function getRow(
  obj: AnyStrategyThresholds,
  key: string,
): MetricThreshold | undefined {
  return (obj as unknown as Record<string, MetricThreshold>)[key];
}

export function ThresholdsTab({
  rows,
  thresholds,
  preset,
  onChange,
  errors,
}: ThresholdsTabProps) {
  function setRow(key: string, next: MetricThreshold) {
    onChange({
      ...(thresholds as object),
      [key]: next,
    } as unknown as AnyStrategyThresholds);
  }

  function resetRow(key: string) {
    const presetRow = getRow(preset, key);
    if (!presetRow) return;
    setRow(key, presetRow);
  }

  return (
    <div className="flex flex-col gap-5">
      {rows.map((row) => {
        const t = getRow(thresholds, row.key);
        const presetRow = getRow(preset, row.key);
        if (!t || !presetRow) return null;
        const err = errors[row.key];
        return (
          <div
            key={row.key}
            data-testid={`threshold-row-${row.key}`}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-on-surface">
                {row.label}
              </label>
              <button
                type="button"
                onClick={() => resetRow(row.key)}
                className="text-xs text-[var(--md-primary)] hover:underline"
                aria-label={`Reset ${row.label} to defaults`}
              >
                Reset
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {LETTERS.map((letter) => (
                <label key={letter} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                    {letter}
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={row.toDisplay(t[letter])}
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value);
                        if (Number.isNaN(raw)) return;
                        setRow(row.key, {
                          ...t,
                          [letter]: row.fromDisplay(raw),
                        });
                      }}
                      aria-label={`${row.label} grade ${letter}`}
                      className="w-full font-mono tabular-nums text-sm bg-surface-container rounded-md px-2 py-1.5 border border-outline-variant focus:outline-none focus:ring-2 focus:ring-[var(--md-primary)]"
                    />
                    {row.suffix && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant pointer-events-none">
                        {row.suffix}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="text-[11px] text-on-surface-variant">
              Default: {row.formatPreset(presetRow)}
            </div>
            {err && (
              <div
                role="alert"
                className="text-xs text-[var(--md-error)]"
                data-testid={`threshold-error-${row.key}`}
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
