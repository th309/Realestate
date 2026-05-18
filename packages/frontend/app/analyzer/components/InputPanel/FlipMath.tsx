"use client";

import type { DealInput, FlipResult } from "@propertyiq/analyzer-core";
import type { AnalyzerAssumptions } from "../../lib/analyzer-assumptions";
import { MathSection, Row, Total, fmtUsd } from "./MetricMathPrimitives";

export function FlipMath({
  input,
  flip,
  arvLocal,
  rehabBudget,
  assumptions,
}: {
  input: DealInput;
  flip: FlipResult;
  arvLocal: number;
  rehabBudget: number;
  assumptions: AnalyzerAssumptions | undefined;
}) {
  const contingencyPct = 0.1;
  const sellingCostsPct = assumptions?.sellingCostsPct ?? 0.07;
  const holdMonths = assumptions?.holdingMonths ?? 4;
  const buyClosingPct = input.financing.closingCostsPct ?? 0.03;

  const rehabAdj = rehabBudget * (1 + contingencyPct);
  const buyClosing = input.price * buyClosingPct;
  const sellingCosts = arvLocal * sellingCostsPct;

  return (
    <>
      <MathSection title="Acquisition">
        <Row label="Purchase price" value={fmtUsd(input.price)} />
        <Row
          label={`+ Closing (${(buyClosingPct * 100).toFixed(1)}%)`}
          value={`+${fmtUsd(buyClosing)}`}
        />
        <Row label="Rehab budget" value={fmtUsd(rehabBudget)} />
        <Row
          label={`+ Contingency (${(contingencyPct * 100).toFixed(0)}%)`}
          value={`+${fmtUsd(rehabBudget * contingencyPct)}`}
        />
        <Total label="= Adjusted rehab" value={fmtUsd(rehabAdj)} />
      </MathSection>

      <MathSection title="Exit">
        <Row label="ARV" value={fmtUsd(arvLocal)} />
        <Row
          label={`− Selling costs (${(sellingCostsPct * 100).toFixed(1)}%)`}
          value={`−${fmtUsd(sellingCosts)}`}
        />
        <Total label="= Net proceeds" value={fmtUsd(arvLocal - sellingCosts)} />
      </MathSection>

      <MathSection title="70% Rule check">
        <Row label="ARV" value={fmtUsd(arvLocal)} />
        <Row label="× 0.70" value={fmtUsd(arvLocal * 0.7)} indent />
        <Row label="− Adjusted rehab" value={`−${fmtUsd(rehabAdj)}`} />
        <Total label="= MAO" value={fmtUsd(arvLocal * 0.7 - rehabAdj)} />
        <Row
          label={`Your price ${fmtUsd(input.price)} vs MAO ${fmtUsd(arvLocal * 0.7 - rehabAdj)}`}
          value={
            input.price <= arvLocal * 0.7 - rehabAdj
              ? "✓ at or below"
              : "above MAO"
          }
        />
      </MathSection>

      <MathSection title="Projected profit (analyzer-core)">
        <Row label="Hold months" value={`${holdMonths} mo`} />
        <Total
          label="= Projected profit"
          value={fmtUsd(flip.projectedProfit)}
        />
        <Total
          label="= Projected ROI"
          value={`${flip.projectedRoiPct.toFixed(1)}%`}
        />
      </MathSection>
    </>
  );
}
