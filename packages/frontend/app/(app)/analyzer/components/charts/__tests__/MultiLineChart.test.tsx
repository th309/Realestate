import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Children, cloneElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

// Recharts' ResponsiveContainer measures its parent (0x0 in jsdom), so charts
// never render. Replace it with a passthrough that injects explicit width/height
// onto the chart child so it draws into a real SVG we can assert against.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => {
      const child = Children.only(children);
      if (!isValidElement(child)) return <>{children}</>;
      return cloneElement(
        child as ReactElement<{ width?: number; height?: number }>,
        {
          width: 800,
          height: 280,
        },
      );
    },
  };
});

import { MultiLineChart } from "../MultiLineChart";

describe("MultiLineChart", () => {
  const sampleData = [
    { year: 1, rent: 2850, expenses: 1800, cashflow: 642 },
    { year: 2, rent: 2935, expenses: 1844, cashflow: 705 },
    { year: 30, rent: 7600, expenses: 4200, cashflow: 2280 },
  ];

  it("renders without crashing", () => {
    const { container } = render(
      <MultiLineChart
        data={sampleData}
        lines={[
          { dataKey: "rent", label: "Rent", color: "primary" },
          { dataKey: "expenses", label: "Expenses", color: "caution" },
          { dataKey: "cashflow", label: "Cashflow", color: "positive" },
        ]}
      />,
    );
    expect(container.querySelector(".recharts-line")).toBeTruthy();
  });

  it("renders one Line per provided series", () => {
    const { container } = render(
      <MultiLineChart
        data={sampleData}
        lines={[
          { dataKey: "rent", label: "Rent", color: "primary" },
          { dataKey: "cashflow", label: "Cashflow", color: "positive" },
        ]}
      />,
    );
    expect(container.querySelectorAll(".recharts-line").length).toBe(2);
  });
});
