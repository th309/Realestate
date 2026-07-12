import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdvancedAssumptions } from "../AdvancedAssumptions";
import { DEFAULT_ASSUMPTIONS } from "../../../lib/analyzer-assumptions";

const baseProps = {
  assumptions: DEFAULT_ASSUMPTIONS,
  onChange: vi.fn(),
  input: { price: 300_000, rentMonthly: 2_000, financing: {} } as never,
  onInputChange: vi.fn(),
  onFinancingChange: vi.fn(),
};

function openSection() {
  fireEvent.click(
    screen.getByRole("button", { name: /advanced assumptions/i }),
  );
}

describe("AdvancedAssumptions customize row", () => {
  it("renders the auto-kill & grading row when onCustomizeClick is provided", () => {
    const onCustomize = vi.fn();
    render(
      <AdvancedAssumptions {...baseProps} onCustomizeClick={onCustomize} />,
    );
    openSection();
    const row = screen.getByTestId("autokill-grading-customize");
    expect(row.textContent).toMatch(/auto-kill & grading criteria/i);
    fireEvent.click(row);
    expect(onCustomize).toHaveBeenCalledTimes(1);
  });

  it("renders no row when the callback is absent", () => {
    render(<AdvancedAssumptions {...baseProps} />);
    openSection();
    expect(screen.queryByTestId("autokill-grading-customize")).toBeNull();
  });
});
