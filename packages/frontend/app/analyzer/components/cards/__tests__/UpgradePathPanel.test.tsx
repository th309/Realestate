import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type {
  DealInput,
  GradingContext,
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

function makeResult(over: Partial<UpgradePathResult> = {}): UpgradePathResult {
  return {
    currentGrade: "B",
    targetGrade: "A",
    achievable: true,
    options: [
      {
        lever: "purchasePrice",
        label: "Negotiate purchase price down",
        currentValue: 350_000,
        targetValue: 335_000,
        delta: -15_000,
        formattedDelta: "-$15,000",
        feasibility: "easy",
        unlocksGrade: "A",
      },
      {
        lever: "monthlyRent",
        label: "Raise rent (renovate, value-add)",
        currentValue: 2_400,
        targetValue: 2_600,
        delta: 200,
        formattedDelta: "+$200/mo",
        feasibility: "moderate",
        unlocksGrade: "A",
      },
      {
        lever: "downPayment",
        label: "Increase down payment",
        currentValue: 70_000,
        targetValue: 87_500,
        delta: 17_500,
        formattedDelta: "+$17,500",
        feasibility: "moderate",
        unlocksGrade: "A",
      },
    ],
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
    expect(
      container.querySelectorAll("[data-upgrade-loading] > div").length,
    ).toBe(3);
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

  it("renders 3 option cards for a typical B→A path", () => {
    upgradePathState.data = makeResult();
    const { container } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="B"
        strategy="BUY_AND_HOLD"
        onApply={() => {}}
      />,
    );
    const cards = container.querySelectorAll("[data-upgrade-option]");
    expect(cards.length).toBe(3);
  });

  it("renders the combination hint card when result is not achievable", () => {
    upgradePathState.data = {
      currentGrade: "D",
      targetGrade: "B",
      achievable: false,
      options: [],
      combinationHint:
        "Drop price by $20,000 and raise rent by $300/mo to reach a B.",
    };
    const { container, getByText } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="D"
        strategy="BUY_AND_HOLD"
        onApply={() => {}}
      />,
    );
    expect(container.querySelector("[data-upgrade-combination]")).toBeTruthy();
    expect(getByText(/Drop price by \$20,000/)).toBeTruthy();
    // Both deltas present → Apply combination button shows.
    expect(
      container.querySelector("[data-upgrade-apply-combination]"),
    ).toBeTruthy();
  });

  it("hides the Apply combination button when the hint doesn't mention both price and rent", () => {
    upgradePathState.data = {
      currentGrade: "D",
      targetGrade: "B",
      achievable: false,
      options: [],
      combinationHint: "Try lowering rate and increasing down payment.",
    };
    const { container } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="D"
        strategy="BUY_AND_HOLD"
        onApply={() => {}}
      />,
    );
    expect(
      container.querySelector("[data-upgrade-apply-combination]"),
    ).toBeNull();
  });

  it("applies a purchasePrice lever to input.price", () => {
    upgradePathState.data = makeResult();
    const onApply = vi.fn();
    const { container } = render(
      <UpgradePathPanel
        input={BASE_INPUT}
        context={BASE_CONTEXT}
        currentGrade="B"
        strategy="BUY_AND_HOLD"
        onApply={onApply}
      />,
    );
    const priceCard = container.querySelector(
      '[data-upgrade-option][data-lever="purchasePrice"]',
    ) as HTMLElement;
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
        currentGrade="B"
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
        currentGrade="B"
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
    // 87,500 / 350,000 = 0.25
    expect(next.financing.downPaymentPct).toBeCloseTo(0.25, 6);
    expect(next.price).toBe(BASE_INPUT.price);
  });
});
