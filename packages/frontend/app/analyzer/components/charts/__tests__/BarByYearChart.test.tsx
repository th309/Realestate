import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BarByYearChart } from "../BarByYearChart";

// Recharts ResponsiveContainer measures its parent at runtime; jsdom reports
// width=0/height=0, so child series render nothing. Replace it with a
// fixed-size pass-through that injects width/height onto the chart so Bar,
// ReferenceLine, etc. actually render.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactElement<{ width?: number; height?: number }>;
    }) => (
      <div style={{ width: 800, height: 280 }}>
        {React.cloneElement(children, { width: 800, height: 280 })}
      </div>
    ),
  };
});

describe("BarByYearChart", () => {
  const data = [
    { year: 1, value: 1200 },
    { year: 2, value: 1450 },
    { year: 3, value: 1700 },
  ];

  it("renders one bar group per data point", () => {
    const { container } = render(<BarByYearChart data={data} />);
    expect(
      container.querySelectorAll(".recharts-bar-rectangle").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("renders one ReferenceLine per benchmark", () => {
    const { container } = render(
      <BarByYearChart
        data={data}
        benchmarks={[
          { value: 1500, label: "Goal", color: "positive" },
          { value: 1000, label: "Floor", color: "caution" },
        ]}
      />,
    );
    expect(container.querySelectorAll(".recharts-reference-line").length).toBe(
      2,
    );
  });
});
