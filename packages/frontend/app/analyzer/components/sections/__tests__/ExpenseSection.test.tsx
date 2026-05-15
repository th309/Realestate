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
    // 5 waterfall steps
    expect(container.querySelectorAll("rect[data-waterfall-bar]").length).toBe(
      5,
    );
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
