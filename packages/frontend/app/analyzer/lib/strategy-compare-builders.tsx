"use client";

import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
  BrrrrTimelineResult,
  BreakEvenResult,
  ProjectionResult,
} from "@propertyiq/analyzer-core";
import { fmtPct, fmtUsd, fmtRatio } from "./format-helpers";
import type { Strategy } from "./strategy-tile-mappers";

interface BuildArgs {
  rental: RentalResult;
  flip: FlipResult | null;
  brrrr: BrrrrResult | null;
  breakEven: BreakEvenResult;
  brrrrTimeline: BrrrrTimelineResult;
  projection: ProjectionResult;
  /** Strategy that gets the green BEST badge on its card. Pass null when
   *  no strategy fits the selected goal — all three cards then render
   *  without a winner badge, matching the BestPlayCallout's "no fit" state. */
  bestPlay: Strategy | null;
  onPickStrategy: (s: Strategy) => void;
}

/**
 * Assemble the four StrategyCompare props (scores / cards / fullViews /
 * summaries) from analyzer-core compute results. Extracted from
 * AnalyzerClient.tsx to keep the page coordinator under the file-size limit.
 */
export function buildStrategyCompareProps({
  rental,
  flip,
  brrrr,
  breakEven,
  brrrrTimeline,
  projection,
  bestPlay,
  onPickStrategy,
}: BuildArgs) {
  const capRateDecimal = rental.capRatePct ? rental.capRatePct / 100 : null;
  const flipRoiDecimal = flip?.projectedRoiPct
    ? flip.projectedRoiPct / 100
    : null;

  const scores = {
    buyAndHold: {
      irr10: projection.horizons.y10.irr,
      cashflowMonthly: rental.cashflowMonthly ?? 0,
    },
    flip: {
      roiPct: flip?.projectedRoiPct ?? 0,
      projectedProfit: flip?.projectedProfit ?? 0,
    },
    brrrr: {
      score: brrrr?.score ?? 0,
      postRefiCashflow: brrrr?.postRefiCashflowMonthly ?? 0,
    },
  };

  const cards = [
    {
      id: "buyAndHold" as const,
      title: "Buy & Hold",
      heroMetric: { label: "Cap Rate", value: fmtPct(capRateDecimal) },
      stats: [
        { label: "Cashflow/mo", value: fmtUsd(rental.cashflowMonthly) },
        { label: "IRR (10y)", value: fmtPct(projection.horizons.y10.irr) },
      ],
      isWinner: bestPlay === "buyAndHold",
      onClick: () => onPickStrategy("buyAndHold"),
    },
    {
      id: "flip" as const,
      title: "Flip",
      heroMetric: { label: "ROI", value: fmtPct(flipRoiDecimal) },
      stats: [
        { label: "Profit", value: fmtUsd(flip?.projectedProfit ?? null) },
      ],
      isWinner: bestPlay === "flip",
      onClick: () => onPickStrategy("flip"),
    },
    {
      id: "brrrr" as const,
      title: "BRRRR",
      heroMetric: {
        label: "Score",
        value: brrrr?.score?.toString() ?? "—",
      },
      stats: [
        {
          label: "Refi cash-out",
          value: fmtUsd(brrrr?.refinanceCashOut ?? null),
        },
      ],
      isWinner: bestPlay === "brrrr",
      onClick: () => onPickStrategy("brrrr"),
    },
  ];

  const fullViews = {
    buyAndHold: (
      <div className="text-sm text-on-surface-variant">
        {fmtUsd(rental.noiAnnual)} NOI; {fmtRatio(rental.dscr)} DSCR; break-even
        rent {fmtUsd(breakEven.rentMonthly)}.
      </div>
    ),
    flip: (
      <div className="text-sm text-on-surface-variant">
        MAO {fmtUsd(flip?.mao70 ?? null)}; profit{" "}
        {fmtUsd(flip?.projectedProfit ?? null)}.
      </div>
    ),
    brrrr: (
      <div className="text-sm text-on-surface-variant">
        Refi after {brrrrTimeline.monthsToFirstRefi}mo; cash left{" "}
        {fmtUsd(brrrr?.remainingCashInDeal ?? null)}.
      </div>
    ),
  };

  const summaries = [
    {
      key: "buyAndHold" as const,
      title: "Buy & Hold",
      heroLabel: "Cap Rate",
      heroValue: fmtPct(capRateDecimal),
      full: <div>NOI {fmtUsd(rental.noiAnnual)}</div>,
      summary: [
        {
          label: "Cashflow",
          value: `${fmtUsd(rental.cashflowMonthly)}/mo`,
        },
      ],
    },
    {
      key: "flip" as const,
      title: "Flip",
      heroLabel: "ROI",
      heroValue: fmtPct(flipRoiDecimal),
      full: <div>MAO {fmtUsd(flip?.mao70 ?? null)}</div>,
      summary: [
        { label: "Profit", value: fmtUsd(flip?.projectedProfit ?? null) },
      ],
    },
    {
      key: "brrrr" as const,
      title: "BRRRR",
      heroLabel: "Score",
      heroValue: brrrr?.score?.toString() ?? "—",
      full: <div>Refi after {brrrrTimeline.monthsToFirstRefi}mo</div>,
      summary: [
        {
          label: "Cash left",
          value: fmtUsd(brrrr?.remainingCashInDeal ?? null),
        },
      ],
    },
  ];

  return { scores, cards, fullViews, summaries };
}
