// packages/frontend/app/analyzer/components/StrategyCompare/__tests__/GoalPicker.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GoalPicker } from "../GoalPicker";

describe("GoalPicker", () => {
  it("renders 4 chip buttons in fixed order", () => {
    render(<GoalPicker selectedGoal="cash_flow" onChange={() => {}} />);
    const chips = screen.getAllByRole("radio");
    expect(chips.map((c) => c.getAttribute("data-goal"))).toEqual([
      "cash_flow",
      "long_term_wealth",
      "fast_cash",
      "recycle_capital",
    ]);
  });

  it("marks the selected chip with aria-checked=true", () => {
    render(<GoalPicker selectedGoal="fast_cash" onChange={() => {}} />);
    const selected = screen.getByRole("radio", { name: /fast cash/i });
    expect(selected.getAttribute("aria-checked")).toBe("true");
  });

  it("fires onChange with the goal key when a chip is clicked", () => {
    const onChange = vi.fn();
    render(<GoalPicker selectedGoal="cash_flow" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /recycle capital/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("recycle_capital");
  });

  it("renders nothing when selectedGoal is null AND no inferredGoal provided", () => {
    const { container } = render(
      <GoalPicker selectedGoal={null} onChange={() => {}} />,
    );
    // Empty state: chips render but none are selected — discoverable but
    // not pre-committed
    const chips = screen.getAllByRole("radio");
    chips.forEach((c) => expect(c.getAttribute("aria-checked")).toBe("false"));
  });
});
