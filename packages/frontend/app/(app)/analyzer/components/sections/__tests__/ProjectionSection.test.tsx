import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ProjectionSection } from "../ProjectionSection";
import type { DealInput, ProjectionResult } from "@propertyiq/analyzer-core";

// jsdom has no real layout, so ResponsiveContainer measures width=0 and
// Recharts skips rendering. Stub it with a fixed-size wrapper so child
// charts receive a real bounding box and emit their SVG nodes.
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

const sampleInput = {
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

const sample: ProjectionResult = {
  yearly: Array.from({ length: 5 }, (_, i) => ({
    year: i + 1,
    grossRent: 30000,
    expenses: 8000,
    cashflow: 5000,
    principalPaydown: 4000,
    appreciationGain: 7000,
    cumulativeEquity: 50000 * (i + 1),
    cumulativeCashflow: 5000 * (i + 1),
    irrToDate: 0.1,
    coCToDate: 0.06,
  })),
  horizons: {
    y1: { equity: 50000, irr: 0.1, cashflow: 5000 },
    y3: { equity: 150000, irr: 0.12, cashflow: 5000 },
    y5: { equity: 250000, irr: 0.13, cashflow: 5000 },
    y10: { equity: 500000, irr: 0.14, cashflow: 5000 },
    y20: { equity: 1000000, irr: 0.15, cashflow: 5000 },
    y30: { equity: 1500000, irr: 0.16, cashflow: 5000 },
  },
};

describe("ProjectionSection", () => {
  it("renders SignatureChart with all four wealth series inline", () => {
    const { container, getByText } = render(
      <ProjectionSection input={sampleInput} projection={sample} />,
    );
    expect(getByText("30-Year Wealth Projection")).toBeTruthy();
    // SignatureChart in multi-series mode renders one Area for the primary
    // series + 3 Line series + legend chips for all 4.
    expect(container.querySelector("[data-signature-chart]")).toBeTruthy();
    expect(container.querySelector("[data-signature-legend]")).toBeTruthy();
    expect(getByText("Equity")).toBeTruthy();
    expect(getByText("Property value")).toBeTruthy();
    expect(getByText("Mortgage balance")).toBeTruthy();
    expect(getByText("Cum. cash flow")).toBeTruthy();
  });

  it("renders AIAnnotation when aiText provided", () => {
    const { container } = render(
      <ProjectionSection
        input={sampleInput}
        projection={sample}
        aiText="Cumulative equity dominates the 30-yr horizon."
      />,
    );
    expect(container.querySelector("[data-section-ai]")?.textContent).toMatch(
      /equity dominates/,
    );
  });
});
