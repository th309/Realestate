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

  it("highlights the current month with full opacity and bold text", () => {
    const n = Array.from({ length: 14 }, (_, i) => 100 + i);
    const p = Array.from({ length: 14 }, (_, i) => 50 + i);
    const months = Array.from(
      { length: 14 },
      (_, i) => `2025-${String(i + 1).padStart(2, "0")}-01`,
    );
    const { container } = render(
      <ListingsActivityChart
        title="Listings activity"
        newListings={n}
        pending={p}
        months={months}
        monthIndex={5}
      />,
    );
    const rects = container.querySelectorAll("rect");
    const texts = container.querySelectorAll("text");
    expect(rects.length).toBeGreaterThan(0);
    expect(texts.length).toBeGreaterThan(0);
    const currentMonthRects = Array.from(rects).slice(12, 14);
    currentMonthRects.forEach((rect) => {
      expect(rect.getAttribute("fillOpacity")).toBe("1");
    });
  });

  it("renders correct number of bars for short series (fewer than 12 months)", () => {
    const n = Array.from({ length: 5 }, (_, i) => 100 + i);
    const p = Array.from({ length: 5 }, (_, i) => 50 + i);
    const months = Array.from(
      { length: 5 },
      (_, i) => `2025-${String(i + 1).padStart(2, "0")}-01`,
    );
    const { container } = render(
      <ListingsActivityChart
        title="Listings activity"
        newListings={n}
        pending={p}
        months={months}
        monthIndex={4}
      />,
    );
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(10);
  });

  it("scales both series correctly when pending > newListings (prevents overflow)", () => {
    const n = [100, 100, 100, 100];
    const p = [200, 250, 150, 200];
    const months = Array.from(
      { length: 4 },
      (_, i) => `2025-${String(i + 1).padStart(2, "0")}-01`,
    );
    const { container } = render(
      <ListingsActivityChart
        title="Listings activity"
        newListings={n}
        pending={p}
        months={months}
        monthIndex={3}
      />,
    );
    const rects = container.querySelectorAll("rect");
    rects.forEach((rect) => {
      const height = parseFloat(rect.getAttribute("height") || "0");
      const y = parseFloat(rect.getAttribute("y") || "0");
      const chartHeight = 190;
      const marginBottom = 22;
      expect(height).toBeGreaterThanOrEqual(0);
      expect(y + height).toBeLessThanOrEqual(chartHeight - marginBottom + 1);
    });
  });

  it("renders null values as zero-height bars without crashing", () => {
    const n = [100, null, 150, null, 120];
    const p = [50, 75, null, 60, 70];
    const months = Array.from(
      { length: 5 },
      (_, i) => `2025-${String(i + 1).padStart(2, "0")}-01`,
    );
    const { container } = render(
      <ListingsActivityChart
        title="Listings activity"
        newListings={n}
        pending={p}
        months={months}
        monthIndex={4}
      />,
    );
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(10);
    const allHeightsValid = Array.from(rects).every((rect) => {
      const height = parseFloat(rect.getAttribute("height") || "0");
      return typeof height === "number" && !isNaN(height) && height >= 0;
    });
    expect(allHeightsValid).toBe(true);
  });
});
