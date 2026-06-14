import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SensitivitySection } from "../SensitivitySection";
import type {
  DealInput,
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";

const input: DealInput = {
  price: 350_000,
  rentMonthly: 2800,
  taxAnnual: 5000,
  insuranceAnnual: 1200,
  hoaMonthly: 0,
  maintenancePctOfRent: 0.08,
  managementPctOfRent: 0.08,
  vacancyPctOfRent: 0.05,
  financing: {
    downPaymentPct: 0.2,
    interestRatePct: 7.1,
    termYears: 30,
    closingCostsPct: 0.03,
  },
} as unknown as DealInput;

const rental = {
  cashflowMonthly: 312,
  capRatePct: 6.8,
  dscr: 1.28,
  noiAnnual: 24_000,
  monthlyDebtService: 1300,
} as unknown as RentalResult;

const flip = {
  projectedProfit: 38_000,
  projectedRoiPct: 22,
  mao70: 305_000,
} as unknown as FlipResult;

const brrrr = {
  score: 75,
  postRefiCashflowMonthly: 180,
  refinanceCashOut: 250_000,
  remainingCashInDeal: 14_000,
} as unknown as BrrrrResult;

const salesComps = [
  { distance: 0.2 },
  { distance: 0.3 },
  { distance: 0.4 },
  { distance: 0.45 },
  { distance: 0.48 },
];

describe("SensitivitySection", () => {
  it("renders header, headline, confidence indicator, and tornado", () => {
    const { container, getByText } = render(
      <SensitivitySection
        input={input}
        rental={rental}
        flip={flip}
        brrrr={brrrr}
        arv={395_000}
        rehabBudget={45_000}
        activeStrategy="buyAndHold"
        salesComps={salesComps}
      />,
    );

    expect(getByText("Sensitivity & Confidence")).toBeTruthy();
    expect(
      container.querySelector('[data-directional-bars][data-layout="tornado"]'),
    ).toBeTruthy();
    expect(container.querySelector("[data-confidence]")).toBeTruthy();
  });

  it("flags High confidence with 5+ comps within 0.5mi", () => {
    const { container } = render(
      <SensitivitySection
        input={input}
        rental={rental}
        flip={flip}
        brrrr={brrrr}
        arv={395_000}
        activeStrategy="buyAndHold"
        salesComps={salesComps}
      />,
    );
    expect(container.querySelector('[data-confidence="high"]')).toBeTruthy();
  });

  it("flags Low confidence with no comps", () => {
    const { container } = render(
      <SensitivitySection
        input={input}
        rental={rental}
        flip={flip}
        brrrr={brrrr}
        arv={395_000}
        activeStrategy="buyAndHold"
        salesComps={[]}
      />,
    );
    expect(container.querySelector('[data-confidence="low"]')).toBeTruthy();
  });
});
