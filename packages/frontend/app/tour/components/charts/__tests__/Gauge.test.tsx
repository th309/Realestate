import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Gauge } from "../Gauge";

describe("Gauge", () => {
  const baseProps = {
    title: "Affordability Index",
    value: "127",
    meta: "vs national 100",
    markerPercent: 60,
    scale: ["Below", "Avg", "Above"] as [string, string, string],
  };

  it("renders title, value, meta", () => {
    const { getByText } = render(<Gauge {...baseProps} />);
    expect(getByText("Affordability Index")).toBeInTheDocument();
    expect(getByText("127")).toBeInTheDocument();
    expect(getByText("vs national 100")).toBeInTheDocument();
  });

  it("renders all three scale labels", () => {
    const { getByText } = render(<Gauge {...baseProps} />);
    expect(getByText("Below")).toBeInTheDocument();
    expect(getByText("Avg")).toBeInTheDocument();
    expect(getByText("Above")).toBeInTheDocument();
  });

  it("clamps markerPercent to 0-100", () => {
    const { container } = render(<Gauge {...baseProps} markerPercent={150} />);
    const marker = container.querySelector('[style*="left"]') as HTMLElement;
    expect(marker.style.left).toBe("100%");
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<Gauge {...baseProps} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#B3261E/i);
    expect(html).not.toMatch(/#FF8F00/i);
    expect(html).not.toMatch(/#00C853/i);
  });
});
