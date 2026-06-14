import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { StackedAreaChart } from "../StackedAreaChart";

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

describe("StackedAreaChart", () => {
  const data = [
    { year: 1, principal: 4000, appreciation: 7000, cashflow: 700 },
    { year: 5, principal: 22000, appreciation: 38000, cashflow: 4200 },
    { year: 10, principal: 50000, appreciation: 90000, cashflow: 9500 },
  ];

  it("renders one Area per spec", () => {
    const { container } = render(
      <StackedAreaChart
        data={data}
        areas={[
          { dataKey: "principal", label: "Principal", color: "primary" },
          { dataKey: "appreciation", label: "Appreciation", color: "positive" },
          { dataKey: "cashflow", label: "Cashflow", color: "caution" },
        ]}
      />,
    );
    expect(container.querySelectorAll(".recharts-area").length).toBe(3);
  });
});
