import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import type {
  BrrrrPerMetricUpgrade,
  BrrrrUpgradeOption,
  BrrrrUpgradePathResult,
  Letter,
} from "@propertyiq/analyzer-core";
import type { UpgradePathBrrrrRequest } from "@/lib/data";

// React Query state stub. Mutated per-test to swap between loading/error/data.
const upgradePathState: {
  data: BrrrrUpgradePathResult | undefined;
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
  useUpgradePathBrrrr: () => ({ ...upgradePathState }),
}));

import { BrrrrUpgradePathPanel } from "../BrrrrUpgradePathPanel";

const BASE_INPUT: UpgradePathBrrrrRequest["input"] = {
  strategy: "BRRRR",
  purchasePrice: 95_000,
  arv: 170_000,
  rehabCost: 40_000,
  holdMonthsBeforeRefi: 6,
  initialFinancingType: "hard_money",
  hardMoneyRate: 12,
  hardMoneyPoints: 0.02,
  hardMoneyLtcPct: 0.8,
  propertyTaxAnnual: 1_800,
  insuranceAnnual: 900,
  refiLtvPct: 0.75,
  refiRate: 7.5,
  refiTermYears: 30,
  monthlyRent: 1_450,
};

const PRICE_OPTION: BrrrrUpgradeOption = {
  lever: "purchasePrice",
  label: "Negotiate purchase price down",
  currentValue: 95_000,
  targetValue: 88_000,
  delta: -7_000,
  formattedDelta: "-$7,000",
  feasibility: "easy",
  unlocksGrade: "B",
};

const RENT_OPTION: BrrrrUpgradeOption = {
  lever: "monthlyRent",
  label: "Push post-refi rent higher",
  currentValue: 1_450,
  targetValue: 1_550,
  delta: 100,
  formattedDelta: "+$100",
  feasibility: "moderate",
  unlocksGrade: "B",
};

function makeResult(
  over: Partial<BrrrrUpgradePathResult> = {},
): BrrrrUpgradePathResult {
  const perMetric: BrrrrPerMetricUpgrade[] = [
    {
      metricKey: "cash_left_in_deal",
      metricLabel: "Cash Left in Deal",
      currentValue: 8_500,
      formattedValue: "$8,500",
      currentGrade: "C",
      targetGrade: "B",
      options: [PRICE_OPTION],
    },
    {
      metricKey: "post_refi_dscr",
      metricLabel: "Post-Refi DSCR",
      currentValue: 1.18,
      formattedValue: "1.18",
      currentGrade: "C",
      targetGrade: "B",
      options: [RENT_OPTION],
    },
  ];
  return {
    currentGrade: "C" as Letter,
    targetGrade: "B" as Letter,
    achievable: true,
    options: [],
    perMetric,
    ...over,
  };
}

describe("BrrrrUpgradePathPanel", () => {
  beforeEach(() => {
    upgradePathState.data = undefined;
    upgradePathState.isLoading = false;
    upgradePathState.isError = false;
    upgradePathState.error = null;
  });

  it("returns null when currentGrade is A", () => {
    upgradePathState.data = makeResult();
    const { container } = render(
      <BrrrrUpgradePathPanel
        input={BASE_INPUT}
        currentGrade={"A" as Letter}
        onApplyBrrrrLever={() => {}}
      />,
    );
    expect(
      container.querySelector("[data-brrrr-upgrade-path-panel]"),
    ).toBeNull();
  });

  it("renders one section per failing metric with its options", () => {
    upgradePathState.data = makeResult();
    const { container } = render(
      <BrrrrUpgradePathPanel
        input={BASE_INPUT}
        currentGrade={"C" as Letter}
        onApplyBrrrrLever={() => {}}
      />,
    );
    expect(container.querySelectorAll("[data-upgrade-metric]").length).toBe(2);
    expect(container.querySelectorAll("[data-upgrade-option]").length).toBe(2);
  });

  it("clicking 'Apply to inputs' fires onApplyBrrrrLever with the option", () => {
    upgradePathState.data = makeResult();
    const onApply = vi.fn();
    const { container } = render(
      <BrrrrUpgradePathPanel
        input={BASE_INPUT}
        currentGrade={"C" as Letter}
        onApplyBrrrrLever={onApply}
      />,
    );
    const applyBtns = container.querySelectorAll("[data-upgrade-apply]");
    fireEvent.click(applyBtns[0]);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].lever).toBe("purchasePrice");
  });

  it("shows 'all clear' state when perMetric is empty", () => {
    upgradePathState.data = makeResult({ perMetric: [] });
    const { container } = render(
      <BrrrrUpgradePathPanel
        input={BASE_INPUT}
        currentGrade={"C" as Letter}
        onApplyBrrrrLever={() => {}}
      />,
    );
    expect(container.querySelector("[data-upgrade-all-clear]")).toBeTruthy();
  });

  it("shows unreachable message for a metric section with no options", () => {
    upgradePathState.data = makeResult({
      perMetric: [
        {
          metricKey: "time_to_refinance_months",
          metricLabel: "Time to Refinance",
          currentValue: 18,
          formattedValue: "18 mo",
          currentGrade: "F",
          targetGrade: "D",
          options: [],
        },
      ],
    });
    const { container } = render(
      <BrrrrUpgradePathPanel
        input={BASE_INPUT}
        currentGrade={"F" as Letter}
        onApplyBrrrrLever={() => {}}
      />,
    );
    expect(
      container.querySelector("[data-upgrade-metric-unreachable]"),
    ).toBeTruthy();
  });

  it("renders the loading skeleton when isLoading", () => {
    upgradePathState.isLoading = true;
    const { container } = render(
      <BrrrrUpgradePathPanel
        input={BASE_INPUT}
        currentGrade={"C" as Letter}
        onApplyBrrrrLever={() => {}}
      />,
    );
    expect(container.querySelector("[data-upgrade-loading]")).toBeTruthy();
  });

  it("renders the error banner when isError", () => {
    upgradePathState.isError = true;
    upgradePathState.error = new Error("boom");
    const { container, getByText } = render(
      <BrrrrUpgradePathPanel
        input={BASE_INPUT}
        currentGrade={"C" as Letter}
        onApplyBrrrrLever={() => {}}
      />,
    );
    expect(container.querySelector("[data-upgrade-error]")).toBeTruthy();
    expect(getByText(/boom/)).toBeTruthy();
  });
});
