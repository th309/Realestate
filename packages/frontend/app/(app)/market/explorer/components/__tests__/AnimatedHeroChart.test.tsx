import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { AnimatedHeroChart } from "../AnimatedHeroChart";
import type { SeriesByMetric } from "../../lib/explorer-math";

// Deterministic, manually-driven rAF + performance.now mocks — avoids
// ambiguity in how Vitest's built-in fake timers coordinate the two.
// useTickInterpolation (used internally by BubbleChart/GeoTileMap) drives
// its blend off these same two globals, so this harness exercises the real
// requestAnimationFrame loop rather than a React state proxy for it.
function useRafMocks() {
  let rafQueue: FrameRequestCallback[] = [];
  let now = 0;
  beforeEach(() => {
    rafQueue = [];
    now = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(performance, "now").mockImplementation(() => now);
  });
  afterEach(() => vi.restoreAllMocks());
  return {
    advance(ms: number) {
      now += ms;
      act(() => {
        const pending = rafQueue;
        rafQueue = [];
        pending.forEach((cb) => cb(now));
      });
    },
    queueLength: () => rafQueue.length,
  };
}

describe("AnimatedHeroChart — map view integration", () => {
  const raf = useRafMocks();

  const regions = [
    { id: "A", name: "Metro A", state: "TX", population: null },
    { id: "B", name: "Metro B", state: "CA", population: null },
    { id: "C", name: "Metro C", state: "NY", population: null },
  ];
  // A (fixed low) and C (fixed high) bracket B, which moves from near the
  // low end (20, month 0) to near the high end (80, month 1). metricColorScalars
  // scales relative to the CURRENT min-max each snapshot — with only two
  // entities B would always be "the max" regardless of its raw value
  // (saturating at 100 both months and masking any blend); the third anchor
  // makes B's computed scalar genuinely differ between the two snapshots.
  const series = {
    home_value: {
      A: [300000, 300000],
      B: [300000, 300000],
      C: [300000, 300000],
    },
    propertyiq_score: { A: [10, 10], B: [20, 80], C: [100, 100] },
    for_sale_inventory: {
      A: [100, 100],
      B: [100, 100],
      C: [100, 100],
    },
  } satisfies SeriesByMetric;

  const base = {
    view: "map" as const,
    boundaries: {
      parentOutline: null,
      viewBoxWidth: 900,
      viewBoxHeight: 500,
      features: [
        { id: "A", path: "M0,0L10,0L10,10L0,10Z" },
        { id: "B", path: "M20,0L40,0L40,20L20,20Z" },
        { id: "C", path: "M50,0L70,0L70,20L50,20Z" },
      ],
      isLoading: false,
      error: null,
    },
    regions,
    series,
    metricId: "score" as const,
    monthIndex: 0,
    lastIdx: 1,
    format: "index" as const,
    axisLabel: "Momentum score (1–99)",
    selectedId: null,
    pinnedIds: [] as string[],
    onSelect: () => {},
    onDrill: () => {},
  };

  function fillOf(container: HTMLElement, id: string) {
    return container
      .querySelector(`path[data-region-id="${id}"]`)
      ?.getAttribute("fill");
  }

  it("holds the exact current-month color with no blend when not playing", () => {
    const { container } = render(
      <AnimatedHeroChart {...base} playing={false} />,
    );
    const fillAtStart = fillOf(container, "B");
    raf.advance(1000);
    expect(fillOf(container, "B")).toBe(fillAtStart);
  });

  it("blends B's fill progressively toward next month's color while playing, via direct DOM writes (no React re-render of the fill prop)", () => {
    const { container } = render(<AnimatedHeroChart {...base} playing />);
    const fillAtT0 = fillOf(container, "B");

    raf.advance(190); // halfway through the tick
    const fillAtHalf = fillOf(container, "B");

    raf.advance(190); // full tick — reaches next month's exact color
    const fillAtFull = fillOf(container, "B");

    expect(fillAtHalf).not.toBe(fillAtT0);
    expect(fillAtFull).not.toBe(fillAtHalf);
  });

  it("does not animate past the last month — no next snapshot to blend toward", () => {
    const { container } = render(
      <AnimatedHeroChart {...base} playing monthIndex={1} lastIdx={1} />,
    );
    const fillAtStart = fillOf(container, "B");
    raf.advance(1000);
    // No rAF loop should even have been scheduled (nextIndex === monthIndex),
    // so the queue stays empty and the fill never moves.
    expect(raf.queueLength()).toBe(0);
    expect(fillOf(container, "B")).toBe(fillAtStart);
  });
});
