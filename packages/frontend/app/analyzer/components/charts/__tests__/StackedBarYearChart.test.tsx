import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { StackedBarYearChart } from "../StackedBarYearChart";

// jsdom has no real layout, so ResponsiveContainer measures width=0 and
// Recharts skips rendering. Stub it with a fixed-size div so child charts
// receive a real bounding box and emit their SVG nodes for assertion.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 400 }}>
        {/* Recharts inspects parent dimensions; provide via inline width/height */}
        <actual.ResponsiveContainer width={800} height={400}>
          {children as React.ReactElement}
        </actual.ResponsiveContainer>
      </div>
    ),
  };
});

describe("StackedBarYearChart", () => {
  const data = [
    { year: 1, preTax: 6000, depreciation: 1500, interest: 1200 },
    { year: 5, preTax: 7200, depreciation: 1500, interest: 900 },
    { year: 10, preTax: 9000, depreciation: 1500, interest: 600 },
  ];

  it("renders one Bar per dataKey", () => {
    const { container } = render(
      <StackedBarYearChart
        data={data}
        bars={[
          { dataKey: "preTax", label: "Pre-tax", color: "primary" },
          { dataKey: "depreciation", label: "Depreciation", color: "positive" },
          { dataKey: "interest", label: "Interest", color: "caution" },
        ]}
      />,
    );
    // Three different bar series, each rendering bars across 3 data points.
    // Recharts renders bar series as separate <g class="recharts-bar"> groups.
    expect(container.querySelectorAll(".recharts-bar").length).toBe(3);
  });
});
