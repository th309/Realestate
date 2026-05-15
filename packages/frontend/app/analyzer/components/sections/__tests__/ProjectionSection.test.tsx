import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ProjectionSection } from "../ProjectionSection";
import type { ProjectionResult } from "@propertyiq/analyzer-core";

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
  it("renders MultiLineChart and BulletBarChart inside SectionWrapper", () => {
    const { container, getByText } = render(
      <ProjectionSection projection={sample} />,
    );
    expect(getByText("30-Year Wealth Projection")).toBeTruthy();
    expect(container.querySelectorAll(".recharts-line").length).toBe(2);
    expect(
      container.querySelectorAll(".recharts-bar-rectangle").length,
    ).toBeGreaterThanOrEqual(6);
  });

  it("renders AIAnnotation when aiText provided", () => {
    const { container } = render(
      <ProjectionSection
        projection={sample}
        aiText="Cumulative equity dominates the 30-yr horizon."
      />,
    );
    expect(container.querySelector("[data-section-ai]")?.textContent).toMatch(
      /equity dominates/,
    );
  });
});
