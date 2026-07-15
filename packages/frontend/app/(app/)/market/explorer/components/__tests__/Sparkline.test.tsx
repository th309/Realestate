import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "../Sparkline";

describe("Sparkline", () => {
  it("renders an svg path for a numeric series", () => {
    const { container } = render(
      <Sparkline series={[1, 3, 2, 5]} markerIndex={3} />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("path")?.getAttribute("d")).toContain("M");
    expect(container.querySelector("circle")).toBeTruthy();
  });
  it("renders an empty svg when there is not enough data", () => {
    const { container } = render(<Sparkline series={[null, null]} />);
    expect(container.querySelector("path")).toBeFalsy();
  });
});
