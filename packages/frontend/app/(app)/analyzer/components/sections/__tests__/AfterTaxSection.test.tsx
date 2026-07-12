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
  yearly: Array.from({ length: 10 }, (_, i) => ({
    year: i + 1,
    preTaxCashflow: 6000,
    depreciationDeduction: 6545,
    interestDeduction: 8500 - i * 100,
    estimatedTaxBenefit: 1500,
    afterTaxCashflow: 7500,
  })),
};

describe("AfterTaxSection", () => {
  it("renders a SignatureChart inside the section", () => {
    const { container, getByText } = render(
      <AfterTaxSection afterTax={afterTax} marginalTaxRate={0.24} />,
    );
    expect(getByText("After-Tax Cashflow")).toBeTruthy();
    // SignatureChart roots itself with this data attribute.
    expect(container.querySelector("[data-signature-chart]")).toBeTruthy();
    // Headline label appears via MetricBlock inside SignatureChart.
    expect(getByText("After-tax cash flow")).toBeTruthy();
  });

  it("sub-label shows year + effective tax rate", () => {
    const { container } = render(
      <AfterTaxSection afterTax={afterTax} marginalTaxRate={0.24} />,
    );
    // Sign-colored forward charts open on TODAY's value (year 1) so the
    // headline color always matches the curve at the point being read.
    // Effective rate = 1 − (7500/6000) = −25% in this fixture (loss-shielded),
    // but pre-tax > 0 path runs and yields a finite negative number; what
    // matters is the sub-label is present in the document.
    expect(container.textContent).toContain("Year 1");
    expect(container.textContent).toContain("effective tax");
  });
});
