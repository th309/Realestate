import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { RefreshAllInsights } from "../RefreshAllInsights";

describe("RefreshAllInsights", () => {
  it("shows 'All insights fresh' when none stale", () => {
    const { container, getByText } = render(
      <RefreshAllInsights staleRefreshers={[]} />,
    );
    expect(getByText(/All insights fresh/)).toBeTruthy();
    const btn = container.querySelector(
      "[data-refresh-all-insights]",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("data-stale-count")).toBe("0");
  });

  it("shows count when stale present", () => {
    const refreshers = [
      { id: "projection", refresh: vi.fn() },
      { id: "comps", refresh: vi.fn() },
      { id: "after_tax", refresh: vi.fn() },
    ];
    const { getByText } = render(
      <RefreshAllInsights staleRefreshers={refreshers} />,
    );
    expect(getByText(/Refresh 3 stale insights/)).toBeTruthy();
  });

  it("clicking invokes ALL refreshers exactly once", () => {
    const refreshers = [
      { id: "projection", refresh: vi.fn() },
      { id: "comps", refresh: vi.fn() },
    ];
    const { container } = render(
      <RefreshAllInsights staleRefreshers={refreshers} />,
    );
    fireEvent.click(container.querySelector("[data-refresh-all-insights]")!);
    expect(refreshers[0].refresh).toHaveBeenCalledTimes(1);
    expect(refreshers[1].refresh).toHaveBeenCalledTimes(1);
  });

  it("disabled when count=0 — click does nothing", () => {
    const refresh = vi.fn();
    const { container } = render(<RefreshAllInsights staleRefreshers={[]} />);
    fireEvent.click(container.querySelector("[data-refresh-all-insights]")!);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("singular 'insight' for count=1", () => {
    const { getByText } = render(
      <RefreshAllInsights staleRefreshers={[{ id: "x", refresh: () => {} }]} />,
    );
    expect(getByText(/Refresh 1 stale insight$/)).toBeTruthy();
  });
});
