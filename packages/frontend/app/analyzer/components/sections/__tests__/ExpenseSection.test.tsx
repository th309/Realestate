import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ExpenseSection } from "../ExpenseSection";

describe("ExpenseSection", () => {
  it("renders waterfall + section title", () => {
    const { container, getByText } = render(
      <ExpenseSection
        grossRentMonthly={2850}
        vacancyMonthly={143}
        opexMonthly={489}
        debtServiceMonthly={1576}
      />,
    );
    expect(getByText("Where the Rent Goes")).toBeTruthy();
    // DirectionalBars (waterfall layout) renders as path-based bars.
    expect(
      container.querySelector(
        '[data-directional-bars][data-layout="waterfall"]',
      ),
    ).toBeTruthy();
  });

  it("renders AI annotation when text provided", () => {
    const { container } = render(
      <ExpenseSection
        grossRentMonthly={2850}
        vacancyMonthly={143}
        opexMonthly={489}
        debtServiceMonthly={1576}
        aiText="Debt eats 55% of gross rent."
      />,
    );
    expect(container.querySelector("[data-section-ai]")?.textContent).toMatch(
      /Debt eats/,
    );
  });
});
