"use client";
import { useState } from "react";
import type { DealInput } from "@propertyiq/analyzer-core";
import { NumField } from "./NumField";
import type { AnalyzerAssumptions } from "../../lib/analyzer-assumptions";
import { DEFAULT_ASSUMPTIONS } from "../../lib/analyzer-assumptions";

interface AdvancedAssumptionsProps {
  assumptions: AnalyzerAssumptions;
  onChange: <K extends keyof AnalyzerAssumptions>(
    key: K,
    value: AnalyzerAssumptions[K],
  ) => void;
  /** Live DealInput so operating-reserve %s, HOA, and closing-cost % can be edited inline. */
  input: DealInput;
  onInputChange: (patch: Partial<DealInput>) => void;
  onFinancingChange: (patch: Partial<DealInput["financing"]>) => void;
}

// analyzer-core defaults — mirrored so reset works on input-side fields too.
const DEFAULT_INPUT_RESERVES = {
  vacancyPctOfRent: 0.05,
  maintenancePctOfRent: 0.08,
  managementPctOfRent: 0.08,
  hoaMonthly: 0,
};
const DEFAULT_CLOSING_PCT = 0.03;

/**
 * Tunable formula inputs grouped by purpose:
 *   - Tax (always shown — drives After-Tax + 30y projection)
 *   - Growth rates (always shown — drives 30y projection slope)
 *   - Flip-only (shown for flip strategy)
 *   - BRRRR-only (shown for brrrr strategy)
 *
 * Defaults match analyzer-core's hardcoded defaults so the user sees identical
 * numbers until they tweak something — no surprise jumps on first render.
 */
export function AdvancedAssumptions({
  assumptions,
  onChange,
  input,
  onInputChange,
  onFinancingChange,
}: AdvancedAssumptionsProps) {
  const [open, setOpen] = useState(false);

  const reset = () => {
    (
      Object.keys(DEFAULT_ASSUMPTIONS) as Array<keyof AnalyzerAssumptions>
    ).forEach((k) => onChange(k, DEFAULT_ASSUMPTIONS[k]));
    onInputChange(DEFAULT_INPUT_RESERVES);
    onFinancingChange({ closingCostsPct: DEFAULT_CLOSING_PCT });
  };

  // Stored as fractions (0.24); displayed as percent (24).
  const pctValue = (v: number) => Math.round(v * 1000) / 10;
  const pctOnChange =
    <K extends keyof AnalyzerAssumptions>(key: K) =>
    (v: number | null) =>
      onChange(key, (v == null ? 0 : v / 100) as AnalyzerAssumptions[K]);
  const pctOnInputChange =
    (
      key: "vacancyPctOfRent" | "maintenancePctOfRent" | "managementPctOfRent",
    ) =>
    (v: number | null) =>
      onInputChange({ [key]: v == null ? 0 : v / 100 });

  return (
    <div className="pt-2 border-t border-outline-variant">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs uppercase font-semibold text-on-surface-variant py-1"
        aria-expanded={open}
      >
        <span>▾ Advanced assumptions</span>
        {open && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              reset();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                reset();
              }
            }}
            className="text-[10px] font-medium normal-case text-primary underline cursor-pointer"
          >
            Reset
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-4 mt-2">
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-semibold text-on-surface-variant">
              Tax
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Marginal tax rate"
                value={pctValue(assumptions.marginalTaxRate)}
                onChange={pctOnChange("marginalTaxRate")}
                suffix="%"
                placeholder="24"
              />
              <NumField
                label="Land value share"
                value={pctValue(assumptions.landValuePct)}
                onChange={pctOnChange("landValuePct")}
                suffix="%"
                placeholder="25"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase font-semibold text-on-surface-variant">
              Operating reserves (% of rent)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Vacancy"
                value={pctValue(input.vacancyPctOfRent ?? 0.05)}
                onChange={pctOnInputChange("vacancyPctOfRent")}
                suffix="%"
                placeholder="5.0"
              />
              <NumField
                label="Maintenance"
                value={pctValue(input.maintenancePctOfRent ?? 0.08)}
                onChange={pctOnInputChange("maintenancePctOfRent")}
                suffix="%"
                placeholder="8.0"
              />
              <NumField
                label="Management"
                value={pctValue(input.managementPctOfRent ?? 0.08)}
                onChange={pctOnInputChange("managementPctOfRent")}
                suffix="%"
                placeholder="8.0"
              />
              <NumField
                label="HOA (monthly)"
                value={input.hoaMonthly ?? 0}
                onChange={(v) => onInputChange({ hoaMonthly: v ?? 0 })}
                prefix="$"
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase font-semibold text-on-surface-variant">
              Financing
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Closing costs"
                value={pctValue(input.financing.closingCostsPct ?? 0.03)}
                onChange={(v) =>
                  onFinancingChange({
                    closingCostsPct: v == null ? 0 : v / 100,
                  })
                }
                suffix="%"
                placeholder="3.0"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase font-semibold text-on-surface-variant">
              Growth (annual)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Appreciation"
                value={pctValue(assumptions.appreciationPct)}
                onChange={pctOnChange("appreciationPct")}
                suffix="%"
                placeholder="3.0"
              />
              <NumField
                label="Rent growth"
                value={pctValue(assumptions.rentGrowthPct)}
                onChange={pctOnChange("rentGrowthPct")}
                suffix="%"
                placeholder="3.0"
              />
              <NumField
                label="Expense growth"
                value={pctValue(assumptions.expenseGrowthPct)}
                onChange={pctOnChange("expenseGrowthPct")}
                suffix="%"
                placeholder="2.5"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
