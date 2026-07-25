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
  colorByRegion: { A: 60, B: 40 },
  radiusByRegion: { A: 1000, B: 3000 },
  axisLabel: "Momentum score (1–99)",
  format: "index" as const,
  selectedId: "A",
  pinnedIds: [] as string[],
  playing: false,
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
  it("renders nearby entities dimmed", () => {
    const props = {
      ...base,
      entities: [{ id: "A", name: "Metro A", state: "TX", nearby: true }],
      selectedId: null,
    };
    const { container } = render(
      <BubbleChart {...props} onSelect={() => {}} onDrill={() => {}} />,
    );
    const circle = container.querySelector("circle");
    expect(circle?.getAttribute("fill-opacity")).toBe("0.38");
  });

  it("bubble fill tracks colorByRegion, not a value frozen to one metric — the bug this fixes", () => {
    const props = { ...base, colorByRegion: { A: 0, B: 100 } };
    const { container } = render(
      <BubbleChart {...props} onSelect={() => {}} onDrill={() => {}} />,
    );
    const circles = container.querySelectorAll("circle");
    expect(circles[0].getAttribute("fill")).not.toBe(
      circles[1].getAttribute("fill"),
    );
  });

  it("suppresses the CSS position transition while playing — AnimatedHeroChart already drives smooth motion via explicit per-frame interpolation (CSS transitions were verified not to animate cx/cy for these SVG elements at all)", () => {
    const { container } = render(
      <BubbleChart {...base} playing onSelect={() => {}} onDrill={() => {}} />,
    );
    const circle = container.querySelector("circle")!;
    expect(circle.style.transition).toBe("none");
  });

  it("keeps a CSS transition while paused, so one-off changes (scrubbing a step, switching metrics) still animate instead of snapping instantly", () => {
    const { container } = render(
      <BubbleChart
        {...base}
        playing={false}
        onSelect={() => {}}
        onDrill={() => {}}
      />,
    );
    const circle = container.querySelector("circle")!;
    expect(circle.style.transition).toMatch(/^cx \d+ms ease, cy \d+ms ease$/);
  });
});
