import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { BubbleChart } from "../BubbleChart";

const base = {
  entities: [
    { id: "A", name: "Metro A", state: "TX" },
    { id: "B", name: "Metro B", state: "CA" },
  ],
  xByRegion: { A: 300000, B: 900000 },
  yByRegion: { A: 55, B: 42 },
  scoreByRegion: { A: 60, B: 40 },
  radiusByRegion: { A: 1000, B: 3000 },
  axisLabel: "Momentum score (1–99)",
  format: "index" as const,
  selectedId: "A",
  pinnedIds: [] as string[],
};

describe("BubbleChart", () => {
  it("renders one bubble per entity", () => {
    const { container } = render(
      <BubbleChart {...base} onSelect={() => {}} onDrill={() => {}} />,
    );
    expect(container.querySelectorAll("circle").length).toBe(2);
  });
  it("selects on click and drills on double-click", () => {
    const onSelect = vi.fn(),
      onDrill = vi.fn();
    const { container } = render(
      <BubbleChart {...base} onSelect={onSelect} onDrill={onDrill} />,
    );
    const circles = container.querySelectorAll("circle");
    fireEvent.click(circles[0]);
    fireEvent.doubleClick(circles[1]);
    expect(onSelect).toHaveBeenCalled();
    expect(onDrill).toHaveBeenCalled();
  });
});
