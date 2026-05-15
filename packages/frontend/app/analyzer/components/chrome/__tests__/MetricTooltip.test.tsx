import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MetricTooltip } from "../MetricTooltip";

describe("MetricTooltip", () => {
  it("renders the glossary name as default label", () => {
    const { getByText } = render(<MetricTooltip metric="cap_rate" />);
    expect(getByText("Cap Rate")).toBeTruthy();
  });

  it("renders custom children when provided", () => {
    const { getByText } = render(
      <MetricTooltip metric="cap_rate">Custom Label</MetricTooltip>,
    );
    expect(getByText("Custom Label")).toBeTruthy();
  });

  it("hover shows tooltip with formula + plain text", () => {
    const { container } = render(<MetricTooltip metric="cap_rate" />);
    expect(container.querySelector("[data-tooltip-body]")).toBeFalsy();
    fireEvent.mouseEnter(container.querySelector("[data-metric-tooltip]")!);
    const body = container.querySelector("[data-tooltip-body]");
    expect(body).toBeTruthy();
    expect(body?.textContent).toMatch(/NOI ÷ Purchase Price/);
  });

  it("mouseLeave hides tooltip", () => {
    const { container } = render(<MetricTooltip metric="cap_rate" />);
    fireEvent.mouseEnter(container.querySelector("[data-metric-tooltip]")!);
    fireEvent.mouseLeave(container.querySelector("[data-metric-tooltip]")!);
    expect(container.querySelector("[data-tooltip-body]")).toBeFalsy();
  });
});
