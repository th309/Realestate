import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MetricSwitcher } from "../MetricSwitcher";

describe("MetricSwitcher", () => {
  it("renders the 6 metric chips and picks one", () => {
    const onPick = vi.fn();
    render(<MetricSwitcher active="score" disabledIds={[]} onPick={onPick} />);
    expect(screen.getByText("Home Value YoY")).toBeTruthy();
    fireEvent.click(screen.getByText("Rent Yield"));
    expect(onPick).toHaveBeenCalledWith("rent_yield");
  });
  it("does not fire for a disabled metric", () => {
    const onPick = vi.fn();
    render(
      <MetricSwitcher
        active="score"
        disabledIds={["hotness"]}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByText("Hotness Score"));
    expect(onPick).not.toHaveBeenCalled();
  });
});
