"use client";

import type {
  BrrrrResult,
  DealInput,
  RentalResult,
} from "@propertyiq/analyzer-core";
import type { AnalyzerAssumptions } from "../../lib/analyzer-assumptions";
import {
  MathSection,
  Row,
  Total,
  fmtPct,
  fmtUsd,
} from "./MetricMathPrimitives";

export function BrrrrMath({
  input,
  brrrr,
  rental,
  arvLocal,
  rehabBudget,
  assumptions,
}: {
  input: DealInput;
  brrrr: BrrrrResult;
  rental: RentalResult | null;
  arvLocal: number;
  rehabBudget: number;
  assumptions: AnalyzerAssumptions | undefined;
}) {
  const refiLTV = assumptions?.refinanceLTVPct ?? 0.75;
  const refiClosingPct = 0.025;
  const refiLoan = arvLocal * refiLTV;
  const refiClosing = refiLoan * refiClosingPct;
  const buyClosingPct = input.financing.closingCostsPct ?? 0.03;
  const buyClosing = input.price * buyClosingPct;
  const seasoningMonths = assumptions?.seasoningMonths ?? 6;
  const rehabMonths = assumptions?.rehabMonths ?? 3;
  const totalHold = seasoningMonths + rehabMonths;
  const allIn = input.price + buyClosing + rehabBudget * 1.1;

  return (
    <>
      <MathSection title="All-in cost">
        <Row label="Purchase" value={fmtUsd(input.price)} />
        <Row label="+ Closing" value={`+${fmtUsd(buyClosing)}`} />
        <Row label="+ Rehab × 1.10" value={`+${fmtUsd(rehabBudget * 1.1)}`} />
        <Total label="= All-in (≈)" value={fmtUsd(allIn)} />
        <Row
          label={`All-in ÷ ARV = ${fmtUsd(allIn)} ÷ ${fmtUsd(arvLocal)}`}
          value={arvLocal > 0 ? fmtPct(allIn / arvLocal) : "—"}
        />
      </MathSection>

      <MathSection title="Cash-out refinance">
        <Row label="ARV" value={fmtUsd(arvLocal)} />
        <Row label={`× ${fmtPct(refiLTV)} LTV`} value="" indent />
        <Total label="= Refi loan" value={fmtUsd(refiLoan)} />
        <Row
          label={`− Refi closing (${fmtPct(refiClosingPct)})`}
          value={`−${fmtUsd(refiClosing)}`}
        />
        <Total
          label="= Cash returned at refi"
          value={fmtUsd(refiLoan - refiClosing)}
        />
      </MathSection>

      <MathSection title="Cash left in deal">
        <Row label="Cash invested upfront" value={fmtUsd(allIn)} />
        <Row
          label="− Cash returned at refi"
          value={`−${fmtUsd(refiLoan - refiClosing)}`}
        />
        <Total
          label="= Cash left in deal"
          value={fmtUsd(brrrr.remainingCashInDeal)}
        />
      </MathSection>

      {rental && (
        <MathSection title="Post-refi cashflow">
          <Row label="NOI (rental)" value={fmtUsd(rental.noiAnnual ?? 0)} />
          <Row
            label="− Refi annual P&I"
            value={`−${fmtUsd(rental.monthlyDebtService * 12)}`}
          />
          <Total
            label="= Monthly cash flow (post-refi)"
            value={fmtUsd(brrrr.postRefiCashflowMonthly)}
          />
        </MathSection>
      )}

      <MathSection title="Timeline">
        <Row label="Rehab months" value={`${rehabMonths} mo`} />
        <Row label="+ Seasoning months" value={`+${seasoningMonths} mo`} />
        <Total label="= Time to refinance" value={`${totalHold} mo`} />
      </MathSection>
    </>
  );
}
