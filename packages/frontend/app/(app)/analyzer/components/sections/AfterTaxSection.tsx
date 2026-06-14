"use client";
import type { AfterTaxResult } from "@propertyiq/analyzer-core";
import { SectionWrapper } from "./SectionWrapper";
import { SignatureChart } from "../primitives/SignatureChart";
import type { DataPoint } from "../primitives/SignatureChart";

interface AfterTaxSectionProps {
  afterTax: AfterTaxResult;
  /** Marginal rate the user set in Advanced Assumptions (display only). */
  marginalTaxRate?: number;
  aiText?: string | null;
  aiIsStale?: boolean;
  aiIsLoading?: boolean;
  onRefreshAi?: () => void;
}

const BASE_YEAR = 2026;

/**
 * One row per year. Primary y = after-tax cashflow. Effective tax rate is
 * derived per year from the analyzer-core output, since shields (interest +
 * depreciation) shrink as the loan amortizes — so the effective rate drifts
 * up over the hold even when the marginal rate is constant.
 *
 *   effectiveRate = 1 − (afterTaxCashflow / preTaxCashflow)
 *
 * When pre-tax cashflow is ≤ 0, effective rate is undefined (passive losses
 * shield other income — there's no "rate applied" to display). Falls back to
 * the user's marginal rate so the sub-label always shows something useful.
 */
function buildAfterTaxData(
  afterTax: AfterTaxResult,
  marginalRateFraction: number,
): DataPoint[] {
  return afterTax.yearly.map((y) => {
    const effRate =
      y.preTaxCashflow > 0
        ? (1 - y.afterTaxCashflow / y.preTaxCashflow) * 100
        : marginalRateFraction * 100;
    return {
      x: y.year,
      y: y.afterTaxCashflow,
      effRate,
    };
  });
}

export function AfterTaxSection({
  afterTax,
  marginalTaxRate = 0.24,
  aiText,
  aiIsStale,
  aiIsLoading,
  onRefreshAi,
}: AfterTaxSectionProps) {
  const data = buildAfterTaxData(afterTax, marginalTaxRate);
  const horizon = data.length;

  return (
    <SectionWrapper
      id="after_tax"
      title="After-Tax Cashflow"
      onRefresh={onRefreshAi}
      aiText={aiText}
      aiIsStale={aiIsStale}
      aiIsLoading={aiIsLoading}
      onRefreshAi={onRefreshAi}
    >
      <SignatureChart
        data={data}
        headlineLabel="After-tax cash flow"
        headlineFormat="currency"
        subLabel={(p) => {
          const yr = Number(p.x);
          const rate =
            typeof p.effRate === "number" ? p.effRate.toFixed(1) : "—";
          return `Year ${yr} · ${BASE_YEAR + yr} · effective tax ${rate}%`;
        }}
        variant="area"
        ranges={[
          { label: "1Y", years: 1 },
          { label: "5Y", years: 5 },
          { label: "10Y", years: 10 },
          ...(horizon >= 20 ? [{ label: "20Y", years: 20 }] : []),
          ...(horizon >= 30 ? [{ label: "30Y", years: 30 }] : []),
        ]}
        defaultRange={Math.min(10, horizon)}
        rangeAnchor="head"
      />
    </SectionWrapper>
  );
}
