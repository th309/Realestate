import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdvancedAssumptions } from "../AdvancedAssumptions";

describe("AdvancedAssumptions — Assumptions & criteria link row", () => {
  it("renders the row with label, subtext, and Edit criteria button when onCustomizeClick is provided", () => {
    const onCustomize = vi.fn();
    render(<AdvancedAssumptions onCustomizeClick={onCustomize} />);

    expect(screen.getByText("Assumptions & criteria")).toBeTruthy();
    expect(
      screen.getByText("Tax, reserves, growth, and auto-kill rules"),
    ).toBeTruthy();

    const button = screen.getByTestId("autokill-grading-customize");
    expect(button.textContent).toMatch(/edit criteria/i);

    fireEvent.click(button);
    expect(onCustomize).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the callback is absent", () => {
    const { container } = render(<AdvancedAssumptions />);
    expect(container).toBeEmptyDOMElement();
  });

  it("no longer renders the HOA field (promoted to InputPanel's main grid)", () => {
    render(<AdvancedAssumptions onCustomizeClick={() => {}} />);
    expect(screen.queryByLabelText(/hoa/i)).toBeNull();
  });

  it("no longer renders any of the removed inline assumption fields", () => {
    render(<AdvancedAssumptions onCustomizeClick={() => {}} />);
    expect(screen.queryByLabelText(/marginal tax rate/i)).toBeNull();
    expect(screen.queryByLabelText(/appreciation/i)).toBeNull();
    expect(screen.queryByLabelText(/rent growth/i)).toBeNull();
  });
});
