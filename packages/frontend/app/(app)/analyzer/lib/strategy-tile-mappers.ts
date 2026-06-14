import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
  BreakEvenResult,
  ProjectionResult,
  AfterTaxResult,
  DealInput,
} from "@propertyiq/analyzer-core";

export type Strategy = "buyAndHold" | "flip" | "brrrr" | "multifamily";

export const STRATEGY_LABEL: Record<Strategy, string> = {
  buyAndHold: "Buy & Hold",
  flip: "Fix & Flip",
  brrrr: "BRRRR",
  multifamily: "Multifamily",
};

export const STRATEGY_LABEL_COMPACT: Record<Strategy, string> = {
  buyAndHold: "B&H",
  flip: "Flip",
  brrrr: "BRRRR",
  multifamily: "MF",
};

export interface TileContext {
  input: DealInput;
  rental: RentalResult;
  flip: FlipResult | null;
  brrrr: BrrrrResult | null;
  projection: ProjectionResult;
  breakEven: BreakEvenResult;
  afterTax?: AfterTaxResult;
  arv: number;
  rehabBudget?: number;
}

export interface StandardTile {
  kind: "standard";
  label: string;
  value: number | null;
  format: "currency" | "percent" | "ratio" | "number" | "raw";
  threshold?: { good: number; warning: number };
}

export interface MaoTile {
  kind: "mao";
  label: string;
  mao: number | null;
  currentPrice: number;
}

export type PrimaryTile = StandardTile | MaoTile;

const DEFAULT_FLIP_HOLD_YEARS = 0.5;
const DEFAULT_CLOSING_PCT = 0.03;

function cashInDeal(input: DealInput, rehab = 0): number {
  const price = input.price ?? 0;
  const downPct = input.financing?.downPaymentPct ?? 0.2;
  const closingPct = input.financing?.closingCostsPct ?? DEFAULT_CLOSING_PCT;
  return price * downPct + price * closingPct + rehab;
}

function cashOnCash(
  input: DealInput,
  rental: RentalResult,
  rehab = 0,
): number | null {
  const cash = cashInDeal(input, rehab);
  if (cash <= 0) return null;
  const annual = (rental.cashflowMonthly ?? 0) * 12;
  return (annual / cash) * 100;
}

export function getPrimaryTiles(
  strategy: Strategy,
  ctx: TileContext,
): PrimaryTile[] {
  // Commercial MF (5+ units) overrides strategy — the relevant tiles are NOI,
  // Cap Rate, DSCR, Price/Unit. Flip and BRRRR don't apply, and the residential
  // buy-and-hold tiles miss commercial primaries (price/unit, implied value).
  if (ctx.input.propertyClass === "commercial_mf") {
    return getCommercialTiles(ctx);
  }
  switch (strategy) {
    case "buyAndHold":
      return getBuyAndHoldTiles(ctx);
    case "multifamily":
      return getMultifamilyTiles(ctx);
    case "flip":
      return getFlipTiles(ctx);
    case "brrrr":
      return getBrrrrTiles(ctx);
  }
}

function getCommercialTiles(ctx: TileContext): PrimaryTile[] {
  const { input, rental } = ctx;
  const units = input.unitCount ?? 1;
  const pricePerUnit = units > 0 ? (input.price ?? 0) / units : null;
  return [
    {
      kind: "standard",
      label: "NOI",
      value: rental.noiAnnual ?? null,
      format: "currency",
    },
    {
      kind: "standard",
      label: "Cap rate",
      value: rental.capRatePct ?? null,
      format: "percent",
      threshold: { good: 6, warning: 4.5 },
    },
    {
      kind: "standard",
      label: "DSCR",
      value: rental.dscr ?? null,
      format: "ratio",
      threshold: { good: 1.25, warning: 1.0 },
    },
    {
      kind: "standard",
      label: "Price / unit",
      value: pricePerUnit,
      format: "currency",
    },
  ];
}

function getBuyAndHoldTiles(ctx: TileContext): PrimaryTile[] {
  const { input, rental } = ctx;
  return [
    {
      kind: "standard",
      label: "Monthly cash flow",
      value: rental.cashflowMonthly ?? null,
      format: "currency",
    },
    {
      kind: "standard",
      label: "Cash-on-cash",
      value: cashOnCash(input, rental),
      format: "percent",
      threshold: { good: 8, warning: 4 },
    },
    {
      kind: "standard",
      label: "Cap rate",
      value: rental.capRatePct ?? null,
      format: "percent",
      threshold: { good: 6, warning: 4.5 },
    },
    {
      kind: "standard",
      label: "DSCR",
      value: rental.dscr ?? null,
      format: "ratio",
      threshold: { good: 1.25, warning: 1.0 },
    },
  ];
}

function getMultifamilyTiles(ctx: TileContext): PrimaryTile[] {
  const { input, rental } = ctx;
  return [
    {
      kind: "standard",
      label: "NOI",
      value: rental.noiAnnual ?? null,
      format: "currency",
    },
    {
      kind: "standard",
      label: "Cap rate",
      value: rental.capRatePct ?? null,
      format: "percent",
      threshold: { good: 6, warning: 4.5 },
    },
    {
      kind: "standard",
      label: "DSCR",
      value: rental.dscr ?? null,
      format: "ratio",
      threshold: { good: 1.25, warning: 1.0 },
    },
    {
      kind: "standard",
      label: "Cash-on-cash",
      value: cashOnCash(input, rental),
      format: "percent",
      threshold: { good: 8, warning: 4 },
    },
  ];
}

function getFlipTiles(ctx: TileContext): PrimaryTile[] {
  const { input, flip } = ctx;
  const annualizedRoi =
    flip?.projectedRoiPct != null
      ? flip.projectedRoiPct / DEFAULT_FLIP_HOLD_YEARS
      : null;
  return [
    {
      kind: "standard",
      label: "Net profit",
      value: flip?.projectedProfit ?? null,
      format: "currency",
    },
    {
      kind: "standard",
      label: "ROI",
      value: flip?.projectedRoiPct ?? null,
      format: "percent",
      threshold: { good: 20, warning: 10 },
    },
    {
      kind: "standard",
      label: "Annualized ROI",
      value: annualizedRoi,
      format: "percent",
      threshold: { good: 40, warning: 20 },
    },
    {
      kind: "mao",
      label: "MAO / 70% Rule",
      mao: flip?.mao70 ?? null,
      currentPrice: input.price ?? 0,
    },
  ];
}

function getBrrrrTiles(ctx: TileContext): PrimaryTile[] {
  const { input, brrrr, rehabBudget } = ctx;
  const totalCashIn = cashInDeal(input, rehabBudget ?? 0);
  const cashRecovery =
    totalCashIn > 0 && brrrr?.refinanceCashOut != null
      ? (brrrr.refinanceCashOut / totalCashIn) * 100
      : null;
  const remaining = brrrr?.remainingCashInDeal ?? 0;
  const cocOnRemaining =
    remaining > 0 && brrrr?.postRefiCashflowMonthly != null
      ? ((brrrr.postRefiCashflowMonthly * 12) / remaining) * 100
      : null;
  return [
    {
      kind: "standard",
      label: "Capital left in deal",
      value: brrrr?.remainingCashInDeal ?? null,
      format: "currency",
    },
    {
      kind: "standard",
      label: "Cash recovery",
      value: cashRecovery,
      format: "percent",
      threshold: { good: 80, warning: 60 },
    },
    {
      kind: "standard",
      label: "Post-refi cash flow",
      value: brrrr?.postRefiCashflowMonthly ?? null,
      format: "currency",
    },
    {
      kind: "standard",
      label: "CoC on remaining",
      value: cocOnRemaining,
      format: "percent",
      threshold: { good: 15, warning: 8 },
    },
  ];
}
