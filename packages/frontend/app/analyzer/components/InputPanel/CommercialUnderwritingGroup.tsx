"use client";
import { NumField } from "./NumField";
import { StrategyGroup } from "./StrategyGroup";
import type { AnalyzerAssumptions } from "../../lib/analyzer-assumptions";

interface CommercialUnderwritingGroupProps {
  assumptions: AnalyzerAssumptions;
  onChange: <K extends keyof AnalyzerAssumptions>(
    key: K,
    value: AnalyzerAssumptions[K],
  ) => void;
  /** When the financing.termYears slider is in commercial mode, it represents
   *  the balloon date (e.g., 7y) rather than the amortization period. We don't
   *  edit termYears here — the existing Term slider does it. We only edit the
   *  amortization basis (which decouples from term once it's set). */
  termYears: number;
  unitCount: number | null;
}

const pctValue = (v: number) => Math.round(v * 1000) / 10;

/**
 * Commercial MF underwriting inputs, only shown when propertyClass === "commercial_mf".
 * Lender constraints (DSCR, cap rate) sit alongside structural loan terms
 * (amortization, capex reserves) that don't apply to residential.
 */
export function CommercialUnderwritingGroup({
  assumptions,
  onChange,
  termYears,
  unitCount,
}: CommercialUnderwritingGroupProps) {
  const totalCapexAnnual =
    (assumptions.capexReserveAnnualPerUnit ?? 0) * (unitCount ?? 1);
  return (
    <>
      <StrategyGroup label="Commercial Underwriting" chip="MF 5+">
        <NumField
          label="Market cap rate"
          value={assumptions.marketCapRatePct}
          onChange={(v) => onChange("marketCapRatePct", v ?? 0)}
          suffix="%"
          placeholder="7.0"
        />
        <NumField
          label="Target DSCR"
          value={
            Number.isFinite(assumptions.targetDSCR)
              ? Math.round(assumptions.targetDSCR * 100) / 100
              : null
          }
          onChange={(v) => onChange("targetDSCR", v ?? 0)}
          placeholder="1.25"
        />
        <NumField
          label="Amortization (yrs)"
          value={assumptions.amortizationYears}
          onChange={(v) => onChange("amortizationYears", v ?? 0)}
          placeholder="30"
        />
        <NumField
          label="Balloon term (yrs)"
          value={termYears}
          onChange={() => {}}
          placeholder="7"
        />
        <NumField
          label="Capex reserve / unit"
          value={assumptions.capexReserveAnnualPerUnit}
          onChange={(v) => onChange("capexReserveAnnualPerUnit", v ?? 0)}
          prefix="$"
          placeholder="300"
        />
      </StrategyGroup>
      <div className="text-[10px] text-on-surface-variant -mt-2 pl-1 leading-snug">
        Loan sized as min(LTV cap, DSCR cap). Capex reserve at $
        {Math.round(assumptions.capexReserveAnnualPerUnit).toLocaleString()}
        /unit × {unitCount ?? 0} units = $
        {Math.round(totalCapexAnnual).toLocaleString()}
        /yr added to opex. Balloon date pulled from the Term slider above.
      </div>
    </>
  );
}
