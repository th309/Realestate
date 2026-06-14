"use client";

/**
 * AssumptionsTab — eight per-user analyzer defaults persisted to
 * `user_preferences.analyzer_defaults` (separate API + cache from
 * thresholds; see `useAnalyzerDefaults`).
 *
 * Storage shape is decimal (0.05) but the UI displays percent (5). The row
 * config below owns that conversion in one place; `parent` only ever sees
 * the decimal shape — matching the backend DTO bounds in `validators.ts`.
 */

import type { AnalyzerDefaults } from "@/lib/data";
import { ASSUMPTION_DEFAULTS } from "./preset-helpers";

interface AssumptionsTabProps {
  defaults: AnalyzerDefaults;
  onChange: (next: AnalyzerDefaults) => void;
  errors: Record<keyof AnalyzerDefaults, string | null>;
}

interface RowConfig {
  key: keyof AnalyzerDefaults;
  label: string;
  /** "percent" stored as decimal (0.05 = 5%); "int" stored as integer years. */
  mode: "percent" | "int";
  /** Default value in storage shape, used for the greyed hint. */
  defaultValue: number;
  /** Tooltip-style explanation under the label. */
  hint: string;
}

const ROWS: RowConfig[] = [
  {
    key: "vacancyPct",
    label: "Vacancy",
    mode: "percent",
    defaultValue: ASSUMPTION_DEFAULTS.vacancyPct,
    hint: "Share of rent lost to vacant months",
  },
  {
    key: "maintenancePct",
    label: "Maintenance",
    mode: "percent",
    defaultValue: ASSUMPTION_DEFAULTS.maintenancePct,
    hint: "Routine repairs & upkeep as % of rent",
  },
  {
    key: "capexPct",
    label: "CapEx Reserve",
    mode: "percent",
    defaultValue: ASSUMPTION_DEFAULTS.capexPct,
    hint: "Roof / HVAC / big-ticket reserve as % of rent",
  },
  {
    key: "pmPct",
    label: "Property Mgmt",
    mode: "percent",
    defaultValue: ASSUMPTION_DEFAULTS.pmPct,
    hint: "PM fee as % of collected rent",
  },
  {
    key: "rentGrowthPct",
    label: "Rent Growth (annual)",
    mode: "percent",
    defaultValue: ASSUMPTION_DEFAULTS.rentGrowthPct,
    hint: "Yearly rent appreciation",
  },
  {
    key: "appreciationPct",
    label: "Price Appreciation (annual)",
    mode: "percent",
    defaultValue: ASSUMPTION_DEFAULTS.appreciationPct,
    hint: "Yearly property value growth",
  },
  {
    key: "closingCostsPct",
    label: "Closing Costs",
    mode: "percent",
    defaultValue: ASSUMPTION_DEFAULTS.closingCostsPct,
    hint: "Closing costs as % of purchase price",
  },
  {
    key: "holdYears",
    label: "Hold Period",
    mode: "int",
    defaultValue: ASSUMPTION_DEFAULTS.holdYears,
    hint: "Years until projected sale",
  },
];

function toDisplay(raw: number | undefined, mode: "percent" | "int"): string {
  if (raw === undefined) return "";
  return mode === "percent" ? String(Math.round(raw * 1000) / 10) : String(raw);
}

function fromDisplay(
  value: string,
  mode: "percent" | "int",
): number | undefined {
  if (value === "") return undefined;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) return undefined;
  return mode === "percent" ? parsed / 100 : Math.round(parsed);
}

function formatHintDefault(row: RowConfig): string {
  return row.mode === "percent"
    ? `Default: ${Math.round(row.defaultValue * 100)}%`
    : `Default: ${row.defaultValue} years`;
}

export function AssumptionsTab({
  defaults,
  onChange,
  errors,
}: AssumptionsTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-on-surface-variant">
        Form defaults used when the analyzer can't infer a value from the
        property. Saved per user.
      </p>
      <div className="flex flex-col gap-3">
        {ROWS.map((row) => {
          const stored = defaults[row.key];
          const err = errors[row.key];
          return (
            <div
              key={row.key}
              data-testid={`assumption-row-${row.key}`}
              className="flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor={`assumption-${row.key}`}
                  className="text-sm text-on-surface flex-1"
                >
                  {row.label}
                </label>
                <div className="relative w-28">
                  <input
                    id={`assumption-${row.key}`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={toDisplay(stored, row.mode)}
                    onChange={(e) => {
                      const next = fromDisplay(e.target.value, row.mode);
                      const merged: AnalyzerDefaults = { ...defaults };
                      if (next === undefined) {
                        delete merged[row.key];
                      } else {
                        (merged[row.key] as number) = next;
                      }
                      onChange(merged);
                    }}
                    aria-label={row.label}
                    className="w-full font-mono tabular-nums text-sm bg-surface-container rounded-md px-2 py-1.5 border border-outline-variant focus:outline-none focus:ring-2 focus:ring-[var(--md-primary)]"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant pointer-events-none">
                    {row.mode === "percent" ? "%" : "y"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-on-surface-variant">
                  {row.hint}
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  {formatHintDefault(row)}
                </span>
              </div>
              {err && (
                <div
                  role="alert"
                  className="text-xs text-[var(--md-error)]"
                  data-testid={`assumption-error-${row.key}`}
                >
                  {err}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
