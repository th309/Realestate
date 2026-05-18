import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import type { BrrrrUpgradePathResult, Letter } from "@propertyiq/analyzer-core";
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

function makeResult(
  over: Partial<BrrrrUpgradePathResult> = {},
): BrrrrUpgradePathResult {
  return {
    currentGrade: "C" as Letter,
    targetGrade: "B" as Letter,
    achievable: true,
    options: [
      {
        lever: "purchasePrice",
        label: "Negotiate purchase price down",
        currentValue: 95_000,
        targetValue: 88_000,
        delta: -7_000,
        formattedDelta: "-$7,000",
        feasibility: "easy",
        unlocksGrade: "B" as Letter,
      },
      {
        lever: "monthlyRent",
        label: "Push post-refi rent higher",
        currentValue: 1_450,
        targetValue: 1_550,
        delta: 100,
        formattedDelta: "+$100",
        feasibility: "moderate",
        unlocksGrade: "B" as Letter,
      },
    ],
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

  it("renders 2 option cards for a typical C→B path", () => {
    upgradePathState.data = makeResult();
    const { container } = render(
      <BrrrrUpgradePathPanel
        input={BASE_INPUT}
        currentGrade={"C" as Letter}
        onApplyBrrrrLever={() => {}}
      />,
    );
    const cards = container.querySelectorAll("[data-upgrade-option]");
    expect(cards.length).toBe(2);
    expect(cards[0].getAttribute("data-lever")).toBe("purchasePrice");
    expect(cards[1].getAttribute("data-lever")).toBe("monthlyRent");
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

  it("shows the combination hint when not achievable on a single lever", () => {
    upgradePathState.data = makeResult({
      achievable: false,
      options: [],
      combinationHint:
        "Combination needed: reduce purchase by ~$5,000 AND push rent up ~$100/mo",
    });
    const { container, getByText } = render(
      <BrrrrUpgradePathPanel
        input={BASE_INPUT}
        currentGrade={"C" as Letter}
        onApplyBrrrrLever={() => {}}
        onApplyBrrrrCombination={() => {}}
      />,
    );
    expect(container.querySelector("[data-upgrade-combination]")).toBeTruthy();
    expect(getByText(/reduce purchase by/)).toBeTruthy();
    expect(
      container.querySelector("[data-upgrade-apply-combination]"),
    ).toBeTruthy();
  });

  it("shows the unreachable message when no path and no hint", () => {
    upgradePathState.data = makeResult({ achievable: false, options: [] });
    const { container } = render(
      <BrrrrUpgradePathPanel
        input={BASE_INPUT}
        currentGrade={"C" as Letter}
        onApplyBrrrrLever={() => {}}
      />,
    );
    expect(container.querySelector("[data-upgrade-unreachable]")).toBeTruthy();
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
