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

import { ComposedSensitivityChart } from "../ComposedSensitivityChart";

describe("ComposedSensitivityChart", () => {
  const data = [
    { year: 1, value: 0.08, bandLow: 0.06, bandHigh: 0.1 },
    { year: 5, value: 0.1, bandLow: 0.07, bandHigh: 0.13 },
    { year: 10, value: 0.12, bandLow: 0.08, bandHigh: 0.16 },
  ];

  it("renders area, line, and reference line", () => {
    const { container } = render(
      <ComposedSensitivityChart
        data={data}
        referenceLine={{ value: 0.09, label: "Target" }}
      />,
    );
    expect(container.querySelector(".recharts-area")).toBeTruthy();
    expect(container.querySelector(".recharts-line")).toBeTruthy();
    expect(container.querySelector(".recharts-reference-line")).toBeTruthy();
  });

  it("renders area+line without reference line when not provided", () => {
    const { container } = render(<ComposedSensitivityChart data={data} />);
    expect(container.querySelector(".recharts-area")).toBeTruthy();
    expect(container.querySelector(".recharts-line")).toBeTruthy();
    expect(container.querySelector(".recharts-reference-line")).toBeFalsy();
  });
});
