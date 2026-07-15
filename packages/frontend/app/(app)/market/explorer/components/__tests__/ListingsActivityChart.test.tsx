import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingsActivityChart } from "../ListingsActivityChart";

describe("ListingsActivityChart", () => {
  it("renders a titled svg with bars", () => {
    const n = Array.from({ length: 14 }, (_, i) => 100 + i);
    const p = Array.from({ length: 14 }, (_, i) => 50 + i);
    const months = Array.from(
      { length: 14 },
      (_, i) => `2025-${String(i + 1).padStart(2, "0")}-01`,
    );
    const { container } = render(
      <ListingsActivityChart
        title="Listings activity — Austin"
        newListings={n}
        pending={p}
        months={months}
        monthIndex={13}
      />,
    );
    expect(screen.getByText(/Listings activity/)).toBeTruthy();
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(0);
  });
});
