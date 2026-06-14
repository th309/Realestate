import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type {
  DealInput,
  GradingContext,
  PerMetricUpgrade,
  UpgradePathOption,
  UpgradePathResult,
} from "@propertyiq/analyzer-core";

// React Query state stub. Mutated per-test to swap between loading/error/data.
const upgradePathState: {
  data: UpgradePathResult | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
};

vi.mock("@/lib/data", () => ({
  useUpgradePath: () => ({ ...upgradePathState }),
}));

import { UpgradePathPanel } from "../UpgradePathPanel";

const BASE_INPUT: DealInput = {
  price: 350_000,
  rentMonthly: 2_400,
  taxAnnual: 4_200,
  insuranceAnnual: 1_400,
  financing: {
    downPaymentPct: 0.2,
    interestRatePct: 7.0,
    termYears: 30,
  },
};

const BASE_CONTEXT: GradingContext = {};

const PRICE_OPTION: UpgradePathOption = {
  lever: "purchasePrice",
  label: "Negotiate purchase price down",
  currentValue: 350_000,
  targetValue: 335_000,
  delta: -15_000,
  formattedDelta: "-$15,000",
  feasibility: "easy",
  unlocksGrade: "D",
};

const RENT_OPTION: UpgradePathOption = {
  lever: "monthlyRent",
  label: "Raise rent (renovate, value-add)",
  currentValue: 2_400,
  targetValue: 2_600,
  delta: 200,
  formattedDelta: "+$200/mo",
  feasibility: "moderate",
  unlocksGrade: "D",
};

const DOWN_PAYMENT_OPTION: UpgradePathOption = {
  lever: "downPayment",
  label: "Increase down payment",
  currentValue: 70_000,
  targetValue: 87_500,
  delta: 17_500,
  formattedDelta: "+$17,500",
  feasibility: "moderate",
  unlocksGrade: "D",
};

function makeResult(over: Partial<UpgradePathResult> = {}): UpgradePathResult {
  const perMetric: PerMetricUpgrade[] = [
    {
      metricKey: "cashOnCash",
      metricLabel: "Cash-on-Cash",
      currentValue: 0.045,
      formattedValue: "4.5%",
      currentGrade: "F",
      targetGrade: "D",
      options: [PRICE_OPTION, RENT_OPTION],
    },
    {
      metricKey: "dscr",
      metricLabel: "DSCR",
      currentValue: 1.05,
      formattedValue: "1.05",
      currentGrade: "F",
      targetGrade: "D",
      options: [RENT_OPTION, DOWN_PAYMENT_OPTION],
    },
  ];
  return {
    currentGrade: "F",
    targetGrade: "D",
    achievable: true,
    options: [],
    perMetric,
    ...over,
  };
}

describe("UpgradePathPanel", () => {
  beforeEach(() => {
    upgradePathState.data = undefined;
    upgradePathState.isLoading = false;
    upgradePathState.isError = false;
    upgradePathState.error = null;
  });

  it("returns null when currentGrade is A", () => {
    upgradePathState.data = makeResult();
    const { container } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="A"
        strategy="BUY_AND_HOLD"
        onApply={() => {}}
      />,
    );
    expect(container.querySelector("[data-upgrade-path-panel]")).toBeNull();
  });

  it("renders skeleton loader when isLoading", () => {
    upgradePathState.isLoading = true;
    const { container } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="B"
        strategy="BUY_AND_HOLD"
        onApply={() => {}}
      />,
    );
    expect(container.querySelector("[data-upgrade-loading]")).toBeTruthy();
  });

  it("renders the error banner when isError", () => {
    upgradePathState.isError = true;
    upgradePathState.error = new Error("network down");
    const { container, getByText } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="C"
        strategy="BUY_AND_HOLD"
        onApply={() => {}}
      />,
    );
    expect(container.querySelector("[data-upgrade-error]")).toBeTruthy();
    expect(getByText(/network down/)).toBeTruthy();
  });

  it("renders one section per failing metric with its options", () => {
    upgradePathState.data = makeResult();
    const { container } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="F"
        strategy="BUY_AND_HOLD"
        onApply={() => {}}
      />,
    );
    expect(container.querySelectorAll("[data-upgrade-metric]").length).toBe(2);
    // Each metric section has its own option list keyed by metricKey-lever-targetValue.
    expect(container.querySelectorAll("[data-upgrade-option]").length).toBe(4);
  });

  it("shows 'all clear' state when perMetric is empty", () => {
    upgradePathState.data = makeResult({ perMetric: [] });
    const { container } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="B"
        strategy="BUY_AND_HOLD"
        onApply={() => {}}
      />,
    );
    expect(container.querySelector("[data-upgrade-all-clear]")).toBeTruthy();
  });

  it("shows unreachable message for a metric section with no options", () => {
    upgradePathState.data = makeResult({
      perMetric: [
        {
          metricKey: "capRate",
          metricLabel: "Cap Rate",
          currentValue: 0.03,
          formattedValue: "3.0%",
          currentGrade: "F",
          targetGrade: "D",
          options: [],
        },
      ],
    });
    const { container } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="F"
        strategy="BUY_AND_HOLD"
        onApply={() => {}}
      />,
    );
    expect(
      container.querySelector("[data-upgrade-metric-unreachable]"),
    ).toBeTruthy();
  });

  it("applies a purchasePrice lever to input.price", () => {
    upgradePathState.data = makeResult();
    const onApply = vi.fn();
    const { container } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="F"
        strategy="BUY_AND_HOLD"
        onApply={onApply}
      />,
    );
    const priceCard = container.querySelector(
      '[data-upgrade-option][data-lever="purchasePrice"]',
    ) as HTMLElement;
    expect(priceCard).toBeTruthy();
    const btn = priceCard.querySelector(
      "[data-upgrade-apply]",
    ) as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onApply).toHaveBeenCalledTimes(1);
    const next = onApply.mock.calls[0][0] as DealInput;
    expect(next.price).toBe(335_000);
    expect(next.rentMonthly).toBe(BASE_INPUT.rentMonthly);
  });

  it("applies a monthlyRent lever to input.rentMonthly", () => {
    upgradePathState.data = makeResult();
    const onApply = vi.fn();
    const { container } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="F"
        strategy="BUY_AND_HOLD"
        onApply={onApply}
      />,
    );
    const rentCard = container.querySelector(
      '[data-upgrade-option][data-lever="monthlyRent"]',
    ) as HTMLElement;
    const btn = rentCard.querySelector(
      "[data-upgrade-apply]",
    ) as HTMLButtonElement;
    fireEvent.click(btn);
    const next = onApply.mock.calls[0][0] as DealInput;
    expect(next.rentMonthly).toBe(2_600);
    expect(next.price).toBe(BASE_INPUT.price);
  });

  it("applies a downPayment lever as a decimal fraction of price", () => {
    upgradePathState.data = makeResult();
    const onApply = vi.fn();
    const { container } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="F"
        strategy="BUY_AND_HOLD"
        onApply={onApply}
      />,
    );
    const dpCard = container.querySelector(
      '[data-upgrade-option][data-lever="downPayment"]',
    ) as HTMLElement;
    const btn = dpCard.querySelector(
      "[data-upgrade-apply]",
    ) as HTMLButtonElement;
    fireEvent.click(btn);
    const next = onApply.mock.calls[0][0] as DealInput;
    expect(next.financing.downPaymentPct).toBeCloseTo(0.25, 6);
    expect(next.price).toBe(BASE_INPUT.price);
  });
});
