/**
 * Builders for the saved + shared analyzer render paths.
 *
 * The /analyzer/saved/[id] and /shared/analysis/[token] routes display a
 * historical snapshot of an analysis — not a live recompute. The fields
 * actually stored are `rental: RentalResult`, optional `flip: FlipResult`,
 * optional `brrrr: BrrrrResult`, plus `market_context: MarketContext`.
 *
 * Projection / sensitivity / break-even / after-tax aren't persisted, so the
 * snapshot views don't get those sections — they only render the KPI strip,
 * strategy grid, and market context. These helpers translate the saved DTO
 * shapes into the props expected by the new components.
 */

import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";
import type { MarketContext } from "@/lib/data";
import type { KPITileProps } from "../components/Hero/KPITile";
import type { StrategyCardData } from "../components/StrategyCompare/ThreeStrategyGrid";
import type { RichResultSnapshot } from "./analyzer-snapshot-types";
import { fmtPct, fmtUsd, fmtRatio } from "./format-helpers";

/**
 * `capRatePct` etc. arrive from analyzer-core in **percentage** form
 * (e.g. 7.8 for 7.8%). `fmtPct` expects a **fraction** (0.078), so divide
 * before formatting. Mirrors the same conversion used in
 * `strategy-compare-builders.tsx`.
 */
const pctToFraction = (v: number | null | undefined): number | null =>
  v == null ? null : v / 100;

export function buildKpiTilesFromRental(
  rental: Partial<RentalResult>,
): KPITileProps[] {
  return [
    {
      label: "Cap Rate",
      value: fmtPct(pctToFraction(rental.capRatePct)),
    },
    {
      label: "Cash-on-cash",
      value: fmtPct(pctToFraction(rental.cashOnCashPct)),
    },
    {
      label: "Cashflow",
      value:
        rental.cashflowMonthly != null
          ? `${fmtUsd(rental.cashflowMonthly)}/mo`
          : "—",
    },
    {
      label: "DSCR",
      value: fmtRatio(rental.dscr ?? null),
    },
  ];
}

/**
 * Build a 1-3 card array for the strategy grid, skipping flip/BRRRR when not
 * computed at save time. Buy & Hold is always present (a saved analysis must
 * have a rental result).
 */
export function buildStrategyCardsFromResult(
  rental: Partial<RentalResult>,
  flip: FlipResult | null | undefined,
  brrrr: BrrrrResult | null | undefined,
): StrategyCardData[] {
  const cards: StrategyCardData[] = [
    {
      id: "buyAndHold",
      title: "Buy & Hold",
      heroMetric: {
        label: "Cap Rate",
        value: fmtPct(pctToFraction(rental.capRatePct)),
      },
      stats: [
        { label: "Cashflow/mo", value: fmtUsd(rental.cashflowMonthly ?? null) },
        { label: "DSCR", value: fmtRatio(rental.dscr ?? null) },
        {
          label: "NOI/yr",
          value: fmtUsd(rental.noiAnnual ?? null),
        },
      ],
    },
  ];

  if (flip) {
    cards.push({
      id: "flip",
      title: "Flip",
      heroMetric: {
        label: "ROI",
        value: fmtPct(pctToFraction(flip.projectedRoiPct)),
      },
      stats: [
        { label: "Profit", value: fmtUsd(flip.projectedProfit ?? null) },
        { label: "70% MAO", value: fmtUsd(flip.mao70 ?? null) },
      ],
    });
  }

  if (brrrr) {
    cards.push({
      id: "brrrr",
      title: "BRRRR",
      heroMetric: {
        label: "Score",
        value: brrrr.score != null ? brrrr.score.toFixed(1) : "—",
      },
      stats: [
        {
          label: "Refi cash-out",
          value: fmtUsd(brrrr.refinanceCashOut ?? null),
        },
        {
          label: "Cash left",
          value: fmtUsd(brrrr.remainingCashInDeal ?? null),
        },
      ],
    });
  }

  return cards;
}

export interface MarketContextSectionInputs {
  /** Pre-baked snapshot blob from saved/shared analyses doesn't include the
   *  geography parent chain — pass null so the section renders pills-free. */
  chain: null;
  initialGeoLevel: "zip" | "county" | "metro" | "state" | null;
  fallbackPiq: number | null;
  fallbackHomeValue: number | null;
  fallbackHomeValueYoy: number | null;
  fallbackRentIndex: number | null;
  fallbackMarketHeat: number | null;
  fallbackNetMigration: number | null;
  /** Persisted AI prose for this section — saved/shared routes never fire a
   *  live AI fetch, so this is the only text the section ever shows. */
  aiText: string | null;
  /** Always false: the snapshot is already resolved, there is nothing to load. */
  aiIsLoading: boolean;
}

/**
 * Map the persisted `market_context` blob (matching `MarketContext`) to the
 * fallback props expected by `MarketContextSection`. Saved analyses are
 * snapshot data with no live geography — pills are suppressed (chain=null)
 * and the section paints the snapshot values without firing trend hooks.
 *
 * `ai` is the persisted `aiNarratives` blob (see `RichResultSnapshot`);
 * mirrors the `market_context ?? comps` preference used by the public share
 * view (`ReadonlyAnalyzerView`) so both read paths render identical prose.
 */
export function extractMarketContextProps(
  mc: MarketContext | Record<string, unknown> | null | undefined,
  ai?: RichResultSnapshot["aiNarratives"],
): MarketContextSectionInputs {
  const ctx = (mc ?? {}) as Partial<MarketContext>;
  const narratives = (ai ?? {}) as NonNullable<
    RichResultSnapshot["aiNarratives"]
  >;
  return {
    chain: null,
    initialGeoLevel: ctx.geo_level ?? null,
    fallbackPiq: ctx.piq_score?.value ?? null,
    fallbackHomeValue: ctx.home_value?.value ?? null,
    fallbackHomeValueYoy: ctx.home_value_yoy?.value ?? null,
    fallbackRentIndex: ctx.rent_index?.value ?? null,
    fallbackMarketHeat: ctx.market_heat?.value ?? null,
    fallbackNetMigration: ctx.net_migration?.value ?? null,
    aiText: narratives.market_context ?? narratives.comps ?? null,
    aiIsLoading: false,
  };
}
