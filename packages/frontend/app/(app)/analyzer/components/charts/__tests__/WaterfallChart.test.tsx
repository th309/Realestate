import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { WaterfallChart } from "../WaterfallChart";

describe("WaterfallChart", () => {
  const steps = [
    { label: "Gross Rent", value: 2850, kind: "start" as const },
    { label: "Vacancy", value: -143, kind: "subtract" as const },
    { label: "OpEx", value: -489, kind: "subtract" as const },
    { label: "Debt", value: -1576, kind: "subtract" as const },
    { label: "Cashflow", value: 642, kind: "end" as const },
  ];

  it("renders one rect per step", () => {
    const { container } = render(<WaterfallChart steps={steps} />);
    expect(container.querySelectorAll("rect[data-waterfall-bar]").length).toBe(
      5,
    );
  });

  it("start step renders in primary color", () => {
    const { container } = render(<WaterfallChart steps={steps} />);
    const first = container.querySelector("rect[data-waterfall-bar]");
    expect(first?.getAttribute("fill")).toMatch(/--md-primary/);
  });
});
