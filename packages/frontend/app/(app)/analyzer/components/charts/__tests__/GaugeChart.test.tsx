import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GaugeChart } from "../GaugeChart";

describe("GaugeChart", () => {
  it("radial: renders track + value arc", () => {
    const { container } = render(
      <GaugeChart value={75} min={0} max={100} variant="radial" />,
    );
    expect(container.querySelector("path[data-gauge-track]")).toBeTruthy();
    expect(container.querySelector("path[data-gauge-value]")).toBeTruthy();
  });

  it("horizontal: renders track + value rect", () => {
    const { container } = render(
      <GaugeChart value={50} min={0} max={100} variant="horizontal" />,
    );
    expect(container.querySelector("rect[data-gauge-track]")).toBeTruthy();
    expect(container.querySelector("rect[data-gauge-value]")).toBeTruthy();
  });

  it("threshold color: high value picks 'good' color", () => {
    const { container } = render(
      <GaugeChart
        value={95}
        min={0}
        max={100}
        variant="radial"
        thresholds={[
          { at: 0.0, color: "negative" },
          { at: 0.5, color: "caution" },
          { at: 0.9, color: "positive" },
        ]}
      />,
    );
    const valuePath = container.querySelector("path[data-gauge-value]");
    expect(valuePath?.getAttribute("fill")).toMatch(/--md-tertiary/);
  });
});
