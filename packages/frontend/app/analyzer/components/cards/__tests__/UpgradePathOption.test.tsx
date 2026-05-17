import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { UpgradePathOption as UpgradePathOptionType } from "@propertyiq/analyzer-core";
import { UpgradePathOption } from "../UpgradePathOption";

function makeOption(
  overrides: Partial<UpgradePathOptionType> = {},
): UpgradePathOptionType {
  return {
    lever: "purchasePrice",
    label: "Negotiate purchase price down",
    currentValue: 350_000,
    targetValue: 335_000,
    delta: -15_000,
    formattedDelta: "-$15,000",
    feasibility: "easy",
    unlocksGrade: "B",
    ...overrides,
  };
}

describe("UpgradePathOption", () => {
  it("renders the option label and feasibility pill with aria-label", () => {
    const onApply = vi.fn();
    const { container, getByText } = render(
      <UpgradePathOption option={makeOption()} index={0} onApply={onApply} />,
    );
    expect(getByText("Negotiate purchase price down")).toBeTruthy();
    const pill = container.querySelector(
      "[data-upgrade-option-feasibility]",
    ) as HTMLElement;
    expect(pill).toBeTruthy();
    expect(pill.getAttribute("aria-label")).toBe("Feasibility: easy");
    expect(pill.textContent).toContain("Easy");
  });

  it("colors the feasibility pill green for easy", () => {
    const { container } = render(
      <UpgradePathOption
        option={makeOption({ feasibility: "easy" })}
        index={0}
        onApply={() => {}}
      />,
    );
    const pill = container.querySelector(
      "[data-upgrade-option-feasibility]",
    ) as HTMLElement;
    // #00C853 → easy
    expect(pill.getAttribute("style") ?? "").toContain("rgb(0, 200, 83)");
  });

  it("renders the 'From X to Y' body text with current and target values", () => {
    const { container } = render(
      <UpgradePathOption
        option={makeOption({ currentValue: 400_000, targetValue: 380_000 })}
        index={0}
        onApply={() => {}}
      />,
    );
    const body = container.querySelector(
      "[data-upgrade-option-body]",
    ) as HTMLElement;
    expect(body.textContent).toContain("$400,000");
    expect(body.textContent).toContain("$380,000");
  });

  it("formats interestRate values as a percent", () => {
    const { container } = render(
      <UpgradePathOption
        option={makeOption({
          lever: "interestRate",
          currentValue: 7.5,
          targetValue: 7.0,
          delta: -0.5,
          formattedDelta: "-0.50pp",
          label: "Buy down the rate",
        })}
        index={0}
        onApply={() => {}}
      />,
    );
    const body = container.querySelector(
      "[data-upgrade-option-body]",
    ) as HTMLElement;
    expect(body.textContent).toContain("7.50%");
    expect(body.textContent).toContain("7.00%");
  });

  it("calls onApply exactly once when the Apply button is clicked", () => {
    const onApply = vi.fn();
    const { container } = render(
      <UpgradePathOption option={makeOption()} index={0} onApply={onApply} />,
    );
    const btn = container.querySelector(
      "[data-upgrade-apply]",
    ) as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
