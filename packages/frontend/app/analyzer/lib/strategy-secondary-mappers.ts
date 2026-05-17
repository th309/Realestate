import type { Strategy, TileContext } from "./strategy-tile-mappers";
import { getCommercialSecondary } from "./strategy-secondary-commercial";

export interface SecondaryTile {
  label: string;
  value: number | string | null;
  format: "currency" | "percent" | "ratio" | "number" | "raw";
}

export function getSecondaryMetrics(
  strategy: Strategy,
  ctx: TileContext,
): SecondaryTile[] {
  // Commercial MF overrides the strategy switch — its secondary tiles surface
  // commercial-specific outputs (binding constraint, balloon, implied value).
  if (ctx.input.propertyClass === "commercial_mf") {
    return getCommercialSecondary(ctx);
  }
  switch (strategy) {
    case "buyAndHold":
      return getBuyAndHoldSecondary(ctx);
    case "flip":
      return getFlipSecondary(ctx);
    case "brrrr":
      return getBrrrrSecondary(ctx);
    case "multifamily":
      return getMultifamilySecondary(ctx);
  }
}

function getBuyAndHoldSecondary(ctx: TileContext): SecondaryTile[] {
  const { input, rental, projection, breakEven, afterTax } = ctx;
  const price = input.price ?? 0;
  const rentMonthly = input.rentMonthly ?? 0;
  const rentAnnual = rentMonthly * 12;

  const grm = rentAnnual > 0 ? price / rentAnnual : null;
  const y1 = projection.yearly?.[0];
  const equityBuildY1 = y1 ? y1.principalPaydown + y1.appreciationGain : null;
  const opexAnnual =
    (input.taxAnnual ?? 0) +
    (input.insuranceAnnual ?? 0) +
    (input.hoaMonthly ?? 0) * 12 +
    rentAnnual *
      ((input.maintenancePctOfRent ?? 0.08) +
        (input.managementPctOfRent ?? 0.08));
  const oer = rentAnnual > 0 ? (opexAnnual / rentAnnual) * 100 : null;
  const onePercent = price > 0 ? (rentMonthly / price) * 100 : null;
  const taxBenefit = afterTax?.yearly?.[0]?.estimatedTaxBenefit ?? null;
  // Total 30-year return = equity at exit + total cashflow collected.
  // Previously multiplied y30.cashflow by 12 × 30, which inflated by 360 if
  // y.cashflow is annual (which it is per the test fixtures: $30K gross /
  // $5K cashflow per year). Use cumulativeCashflow at year 30 instead.
  const cumulativeCashflow30 =
    projection.yearly[projection.yearly.length - 1]?.cumulativeCashflow ?? 0;
  // Equity at exit by accounting identity (don't trust horizons.y30.equity
  // without seeing analyzer-core's definition).
  const priceForEquity = input.price ?? 0;
  const downPctForEquity = input.financing?.downPaymentPct ?? 0.2;
  const initialLoan = priceForEquity * (1 - downPctForEquity);
  const totalPrincipalPaid = projection.yearly.reduce(
    (sum, yr) => sum + yr.principalPaydown,
    0,
  );
  // appreciationGain is cumulative-since-year-0 in analyzer-core, so read the
  // last year directly instead of summing (which would compound the cumulative).
  const totalAppreciation =
    projection.yearly[projection.yearly.length - 1]?.appreciationGain ?? 0;
  const propertyValueAtExit = priceForEquity + totalAppreciation;
  const mortgageAtExit = Math.max(0, initialLoan - totalPrincipalPaid);
  const equityAtExit = propertyValueAtExit - mortgageAtExit;
  const totalReturnExit = equityAtExit + cumulativeCashflow30;
  const breakEvenOcc =
    breakEven.occupancy != null ? breakEven.occupancy * 100 : null;

  return [
    {
      label: "IRR (10y)",
      // Decimal → percent units for MetricBlock format="percent".
      value:
        projection.horizons.y10?.irr != null
          ? projection.horizons.y10.irr * 100
          : null,
      format: "percent",
    },
    { label: "GRM", value: grm, format: "ratio" },
    { label: "NOI", value: rental.noiAnnual ?? null, format: "currency" },
    {
      label: "Total ROI Y1",
      value: y1?.irrToDate != null ? y1.irrToDate * 100 : null,
      format: "percent",
    },
    { label: "Equity build Y1", value: equityBuildY1, format: "currency" },
    {
      label: "1% Rule",
      value: onePercent == null ? null : onePercent >= 1 ? "Pass" : "Fail",
      format: "raw",
    },
    { label: "OER", value: oer, format: "percent" },
    { label: "Break-even occupancy", value: breakEvenOcc, format: "percent" },
    {
      label: "Vacancy buffer",
      value: breakEven.occupancyCushionPct ?? null,
      format: "percent",
    },
    { label: "Tax benefit Y1", value: taxBenefit, format: "currency" },
    {
      label: "Total return at exit (30y)",
      value: totalReturnExit,
      format: "currency",
    },
    { label: "Price / sqft", value: null, format: "currency" },
  ];
}

function getFlipSecondary(ctx: TileContext): SecondaryTile[] {
  const { input, flip, arv, rehabBudget = 45_000 } = ctx;
  const price = input.price ?? 0;
  const downPct = input.financing?.downPaymentPct ?? 0.2;
  const closingPct = input.financing?.closingCostsPct ?? 0.03;
  const closing = price * closingPct;
  const totalCost = price + rehabBudget + closing;
  const loan = price * (1 - downPct);
  const sellingCosts = arv * 0.07;
  const ltc = totalCost > 0 ? (loan / totalCost) * 100 : null;
  const ltvAtAcq = arv > 0 ? (loan / arv) * 100 : null;
  const profitMargin =
    arv > 0 && flip?.projectedProfit != null
      ? (flip.projectedProfit / arv) * 100
      : null;
  const costPerSqftPlaceholder = null;

  return [
    { label: "Total project cost", value: totalCost, format: "currency" },
    {
      label: "Holding costs (6mo est)",
      value: (input.taxAnnual ?? 0) / 2 + (input.insuranceAnnual ?? 0) / 2,
      format: "currency",
    },
    { label: "Selling costs (7%)", value: sellingCosts, format: "currency" },
    { label: "LTC", value: ltc, format: "percent" },
    { label: "LTV at acquisition", value: ltvAtAcq, format: "percent" },
    { label: "Profit margin", value: profitMargin, format: "percent" },
    { label: "Days to break even", value: null, format: "number" },
    { label: "Contingency used", value: null, format: "percent" },
    { label: "Cost / sqft", value: costPerSqftPlaceholder, format: "currency" },
    { label: "Comp spread", value: null, format: "currency" },
  ];
}

function getBrrrrSecondary(ctx: TileContext): SecondaryTile[] {
  const {
    input,
    brrrr,
    brrrrTimeline,
    rental,
    arv,
    rehabBudget = 45_000,
  } = ctx as TileContext & {
    brrrrTimeline?: { monthsToFirstRefi: number };
  };
  const price = input.price ?? 0;
  const downPct = input.financing?.downPaymentPct ?? 0.2;
  const closingPct = input.financing?.closingCostsPct ?? 0.03;
  const closing = price * closingPct;
  const totalCashIn = price * downPct + closing + rehabBudget;
  const totalCost = price + rehabBudget;
  const equityCaptured = arv > 0 && totalCost > 0 ? arv - totalCost : null;
  const forcedAppreciation =
    price > 0 && arv > 0 ? ((arv - price) / price) * 100 : null;
  const arvToCost = totalCost > 0 && arv > 0 ? arv / totalCost : null;
  const breakEvenArv = totalCost / 0.75; // assumes 75% LTV refi

  return [
    { label: "Total cash in", value: totalCashIn, format: "currency" },
    {
      label: "Refi cash-out",
      value: brrrr?.refinanceCashOut ?? null,
      format: "currency",
    },
    { label: "Hard money interest paid", value: null, format: "currency" },
    {
      label: "Seasoning required",
      value: brrrrTimeline?.monthsToFirstRefi ?? 6,
      format: "number",
    },
    {
      label: "Stabilized cap rate",
      value: rental.capRatePct ?? null,
      format: "percent",
    },
    { label: "Post-refi DSCR", value: null, format: "ratio" },
    { label: "Equity captured", value: equityCaptured, format: "currency" },
    {
      label: "Forced appreciation",
      value: forcedAppreciation,
      format: "percent",
    },
    { label: "ARV-to-cost ratio", value: arvToCost, format: "ratio" },
    { label: "Break-even ARV", value: breakEvenArv, format: "currency" },
  ];
}

function getMultifamilySecondary(ctx: TileContext): SecondaryTile[] {
  const { input, rental, projection, breakEven } = ctx;
  const price = input.price ?? 0;
  const rentMonthly = input.rentMonthly ?? 0;
  const rentAnnual = rentMonthly * 12;
  const grm = rentAnnual > 0 ? price / rentAnnual : null;
  const opexAnnual =
    (input.taxAnnual ?? 0) +
    (input.insuranceAnnual ?? 0) +
    rentAnnual *
      ((input.maintenancePctOfRent ?? 0.08) +
        (input.managementPctOfRent ?? 0.08));
  const oer = rentAnnual > 0 ? (opexAnnual / rentAnnual) * 100 : null;
  const economicOccupancy = 100 - (input.vacancyPctOfRent ?? 0.05) * 100;
  const breakEvenOcc =
    breakEven.occupancy != null ? breakEven.occupancy * 100 : null;
  // Equity multiple = total return / cash invested. Previously multiplied by
  // 12 × 10 (inflated 12× if cashflow is annual) and divided by a hardcoded
  // $100K placeholder. Compute properly: cumulative cashflow over 10 years +
  // equity at year 10 (accounting identity), divided by actual cashInDeal.
  const cashflowY10 = projection.yearly
    .slice(0, 10)
    .reduce((sum, yr) => sum + yr.cashflow, 0);
  const downPctMF = input.financing?.downPaymentPct ?? 0.2;
  const closingPctMF = input.financing?.closingCostsPct ?? 0.03;
  const cashInMF = price * downPctMF + price * closingPctMF;
  const loanMF = price * (1 - downPctMF);
  let principalY10 = 0;
  for (let i = 0; i < Math.min(10, projection.yearly.length); i++) {
    principalY10 += projection.yearly[i].principalPaydown;
  }
  // appreciationGain at year N is already cumulative — index directly.
  const yearIdx = Math.min(9, projection.yearly.length - 1);
  const appreciationY10 =
    yearIdx >= 0 ? (projection.yearly[yearIdx]?.appreciationGain ?? 0) : 0;
  const equityY10 =
    price + appreciationY10 - Math.max(0, loanMF - principalY10);
  const equityMultiple =
    cashInMF > 0 ? (equityY10 + cashflowY10) / cashInMF : null; // rough placeholder until cashInDeal flows through

  return [
    { label: "GRM", value: grm, format: "ratio" },
    { label: "Price / unit", value: null, format: "currency" },
    { label: "OER", value: oer, format: "percent" },
    { label: "Loss to lease", value: null, format: "percent" },
    {
      label: "Economic occupancy",
      value: economicOccupancy,
      format: "percent",
    },
    {
      label: "IRR (10y)",
      // Decimal → percent units for MetricBlock format="percent".
      value:
        projection.horizons.y10?.irr != null
          ? projection.horizons.y10.irr * 100
          : null,
      format: "percent",
    },
    { label: "Equity multiple", value: equityMultiple, format: "ratio" },
    {
      label: "Going-in vs stabilized cap",
      value: rental.capRatePct ?? null,
      format: "percent",
    },
    { label: "Break-even occupancy", value: breakEvenOcc, format: "percent" },
    { label: "Rent roll variance", value: null, format: "percent" },
  ];
}
