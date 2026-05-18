"use client";
import type {
  DealInput,
  ProjectionResult,
  AfterTaxResult,
} from "@propertyiq/analyzer-core";
import { SectionWrapper } from "./SectionWrapper";
import { SignatureChart } from "../primitives/SignatureChart";
import type { DataPoint, SeriesSpec } from "../primitives/SignatureChart";
import { MetricsExpander } from "../MetricsExpander";
import { piq } from "../primitives/piqTokens";
import type { SecondaryTile } from "../../lib/strategy-secondary-mappers";

interface ProjectionSectionProps {
  input: DealInput;
  projection: ProjectionResult;
  afterTax?: AfterTaxResult;
  aiText?: string | null;
  aiIsStale?: boolean;
  aiIsLoading?: boolean;
  onRefreshAi?: () => void;
}

const BASE_YEAR = 2026;

function buildProjectionDetails(
  projection: ProjectionResult,
  afterTax?: AfterTaxResult,
): SecondaryTile[] {
  // y.cashflow is per-year (annual cashflow IN year N) — summing is correct.
  // y.principalPaydown is per-year — summing is correct.
  // y.appreciationGain is CUMULATIVE since year 0 — read last year directly.
  const lastYear = projection.yearly[projection.yearly.length - 1];
  const totalCashflow = lastYear?.cumulativeCashflow ?? 0;
  const totalAppreciation = lastYear?.appreciationGain ?? 0;
  const totalPrincipal = projection.yearly.reduce(
    (sum, y) => sum + y.principalPaydown,
    0,
  );
  const saleProceedsAtExit = projection.horizons.y30.equity * 0.93;
  const totalTaxBenefit =
    afterTax?.yearly?.reduce((sum, y) => sum + y.estimatedTaxBenefit, 0) ??
    null;

  return [
    {
      label: "Total cash flow (30y)",
      value: totalCashflow,
      format: "currency",
    },
    {
      label: "Total appreciation",
      value: totalAppreciation,
      format: "currency",
    },
    {
      label: "Total principal paydown",
      value: totalPrincipal,
      format: "currency",
    },
    {
      label: "Sale proceeds at exit (after 7% costs)",
      value: saleProceedsAtExit,
      format: "currency",
    },
    {
      label: "Total tax benefit (30y)",
      value: totalTaxBenefit,
      format: "currency",
    },
    {
      label: "IRR Y1",
      value: projection.horizons.y1.irr * 100,
      format: "percent",
    },
    {
      label: "IRR Y3",
      value: projection.horizons.y3.irr * 100,
      format: "percent",
    },
    {
      label: "IRR Y5",
      value: projection.horizons.y5.irr * 100,
      format: "percent",
    },
    {
      label: "IRR Y10",
      value: projection.horizons.y10.irr * 100,
      format: "percent",
    },
    {
      label: "IRR Y20",
      value: projection.horizons.y20.irr * 100,
      format: "percent",
    },
    {
      label: "IRR Y30",
      value: projection.horizons.y30.irr * 100,
      format: "percent",
    },
  ];
}

/**
 * One row per year with all wealth-component series flattened onto the same
 * DataPoint. SignatureChart's multi-series mode reads each series via its
 * `key`, so all 4 lines render on one chart with a unified scrub.
 */
function buildWealthDataPoints(
  input: DealInput,
  projection: ProjectionResult,
): DataPoint[] {
  const price = input.price ?? 0;
  const downPct = input.financing?.downPaymentPct ?? 0.2;
  const initialLoan = price * (1 - downPct);

  let cumulativePrincipal = 0;
  return projection.yearly.map((y) => {
    cumulativePrincipal += y.principalPaydown;
    // y.appreciationGain is ALREADY cumulative since year 0 (analyzer-core
    // computes it as propertyValue - input.price, where propertyValue is
    // compounded annually). Use directly — don't sum across years.
    const propertyValue = price + y.appreciationGain;
    const mortgageBalance = Math.max(0, initialLoan - cumulativePrincipal);
    // Equity by accounting identity: property value − mortgage balance.
    return {
      x: y.year,
      equity: propertyValue - mortgageBalance,
      mortgageBalance,
      cashflow: y.cumulativeCashflow,
      propertyValue,
    };
  });
}

const WEALTH_SERIES: SeriesSpec[] = [
  { key: "equity", label: "Equity", color: piq.indigo, isPrimary: true },
  { key: "propertyValue", label: "Property value", color: piq.amber },
  { key: "mortgageBalance", label: "Mortgage balance", color: piq.red },
  { key: "cashflow", label: "Cum. cash flow", color: piq.green },
];

export function ProjectionSection({
  input,
  projection,
  afterTax,
  aiText,
  aiIsStale,
  aiIsLoading,
  onRefreshAi,
}: ProjectionSectionProps) {
  const wealthData = buildWealthDataPoints(input, projection);
  const details = buildProjectionDetails(projection, afterTax);

  return (
    <SectionWrapper
      id="projection"
      title="30-Year Wealth Projection"
      onRefresh={onRefreshAi}
      aiText={aiText}
      aiIsStale={aiIsStale}
      aiIsLoading={aiIsLoading}
      onRefreshAi={onRefreshAi}
    >
      <SignatureChart
        data={wealthData}
        series={WEALTH_SERIES}
        headlineLabel="Projected equity"
        headlineFormat="currency"
        subLabel={(p) => `Year ${p.x} · ${BASE_YEAR + Number(p.x)}`}
        variant="area"
        ranges={[
          { label: "1Y", years: 1 },
          { label: "5Y", years: 5 },
          { label: "10Y", years: 10 },
          { label: "30Y", years: 30 },
        ]}
        defaultRange={30}
        rangeAnchor="head"
      />

      <MetricsExpander metrics={details} />
    </SectionWrapper>
  );
}
