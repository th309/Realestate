import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { ConfidenceDisplay } from "../ConfidenceDisplay";

const baseProps = {
  level: "b" as const,
  percentage: 72,
  metricsAvailable: 3,
  metricsTotal: 4,
  freshnessInDays: 12,
  warning: "Some metrics are stale",
};

describe("ConfidenceDisplay — touch fallback", () => {
  it("renders the trigger as a real button element", () => {
    render(<ConfidenceDisplay {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /b confidence: 72%/i });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("type", "button");
  });

  it("hover still opens the tooltip on desktop (existing behavior preserved)", () => {
    render(<ConfidenceDisplay {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /b confidence: 72%/i });

    expect(screen.queryByRole("tooltip")).toBeFalsy();
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).toBeFalsy();
  });

  it("tap (click) opens the tooltip", () => {
    render(<ConfidenceDisplay {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /b confidence: 72%/i });

    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("second tap closes the tooltip", () => {
    render(<ConfidenceDisplay {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /b confidence: 72%/i });

    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).toBeFalsy();
  });

  it("outside click closes an open tooltip", () => {
    render(<ConfidenceDisplay {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /b confidence: 72%/i });

    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("tooltip")).toBeFalsy();
  });

  it("clicking inside the open tooltip content does not close it (regression)", () => {
    render(<ConfidenceDisplay {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /b confidence: 72%/i });

    fireEvent.click(trigger);
    const tooltip = screen.getByRole("tooltip");
    fireEvent.click(tooltip);
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("Escape closes an open tooltip", () => {
    render(<ConfidenceDisplay {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /b confidence: 72%/i });

    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeFalsy();
  });

  it("preserves the exact tooltip content — metrics available, freshness, warning", () => {
    render(<ConfidenceDisplay {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /b confidence: 72%/i });

    fireEvent.click(trigger);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toMatch(/Grade B Confidence \(72%\)/);
    expect(tooltip.textContent).toMatch(/3 of 4 metrics available/);
    expect(tooltip.textContent).toMatch(/12 days old/);
    expect(tooltip.textContent).toMatch(/Some metrics are stale/);
  });

  it("preserves star rating and percentage/warning content when showDetails is true", () => {
    render(<ConfidenceDisplay {...baseProps} showDetails />);
    expect(screen.getByText("72%")).toBeTruthy();
  });
});
