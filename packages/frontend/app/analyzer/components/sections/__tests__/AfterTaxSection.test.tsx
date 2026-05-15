import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AfterTaxSection } from "../AfterTaxSection";
import type { AfterTaxResult } from "@propertyiq/analyzer-core";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 280 }}>
        <actual.ResponsiveContainer width={800} height={280}>
          {children as React.ReactElement}
        </actual.ResponsiveContainer>
      </div>
    ),
  };
});

const afterTax: AfterTaxResult = {
  yearly: Array.from({ length: 5 }, (_, i) => ({
    year: i + 1,
    preTaxCashflow: 6000,
    depreciationDeduction: 6545,
    interestDeduction: 8500 - i * 100,
    estimatedTaxBenefit: 1500,
    afterTaxCashflow: 7500,
  })),
};

describe("AfterTaxSection", () => {
  it("renders stacked bar chart inside section", () => {
    const { container, getByText } = render(
      <AfterTaxSection afterTax={afterTax} />,
    );
    expect(getByText("After-Tax Cashflow")).toBeTruthy();
    // 3 bar series
    expect(container.querySelectorAll(".recharts-bar").length).toBe(3);
  });
});
