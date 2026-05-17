"use client";

/**
 * ThresholdsTab — five metric rows, four A/B/C/D inputs each.
 *
 * The component is presentation-only: it doesn't fetch, save, or own
 * canonical state. Parent owns `thresholds` and gets a fresh object back
 * via `onChange`. Per-row Reset uses presets supplied by the parent so the
 * tab stays preset-agnostic.
 *
 * Display vs storage conversion lives in METRIC_ROWS (see preset-helpers).
 * That keeps inputs human-readable ("12") while the wire format stays
 * decimal (0.12).
 */

import type {
  MetricThreshold,
  UserThresholds,
} from "@propertyiq/analyzer-core";
import { METRIC_ROWS, type MetricKey } from "./preset-helpers";

interface ThresholdsTabProps {
  thresholds: UserThresholds;
  preset: UserThresholds;
  onChange: (next: UserThresholds) => void;
  errors: Partial<Record<MetricKey, string | null>>;
}

const LETTERS: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];

export function ThresholdsTab({
  thresholds,
  preset,
  onChange,
  errors,
}: ThresholdsTabProps) {
  function setRow(key: MetricKey, next: MetricThreshold) {
    onChange({ ...thresholds, [key]: next });
  }

  function resetRow(key: MetricKey) {
    onChange({ ...thresholds, [key]: preset[key] });
  }

  return (
    <div className="flex flex-col gap-5">
      {METRIC_ROWS.map((row) => {
        const t = thresholds[row.key];
        const presetRow = preset[row.key];
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
