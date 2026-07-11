import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MomentumMapTimeline, formatMonthLabel } from "../MomentumMapTimeline";
import { MomentumSummaryStrip } from "../MomentumSummaryStrip";

const months = ["2007-11-30", "2007-12-31", "2008-01-31"];

function renderTimeline(size: "hero" | "card" = "hero") {
  const onSeek = vi.fn();
  const onTogglePlay = vi.fn();
  const onFrameMsChange = vi.fn();
  render(
    <MomentumMapTimeline
      months={months}
      currentFrame={0}
      isPlaying={false}
      frameMs={125}
      size={size}
      onTogglePlay={onTogglePlay}
      onSeek={onSeek}
      onFrameMsChange={onFrameMsChange}
    />,
  );
  return { onSeek, onTogglePlay, onFrameMsChange };
}

describe("formatMonthLabel", () => {
  it("formats an ISO date as month + year", () => {
    expect(formatMonthLabel("2026-05-31")).toBe("May 2026");
    expect(formatMonthLabel("2001-01-31")).toBe("Jan 2001");
  });
});

describe("MomentumMapTimeline", () => {
  it("seeks when the scrubber moves", () => {
    const { onSeek } = renderTimeline();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "2" } });
    expect(onSeek).toHaveBeenCalledWith(2);
  });

  it("toggles play and shows the speed selector in hero size", () => {
    const { onTogglePlay } = renderTimeline("hero");
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(onTogglePlay).toHaveBeenCalled();
    expect(screen.getByLabelText("Playback speed")).toBeTruthy();
  });

  it("hides the speed selector in card size", () => {
    renderTimeline("card");
    expect(screen.queryByLabelText("Playback speed")).toBeNull();
  });

  it("renders era tick marks on the track", () => {
    renderTimeline();
    // months include the GFC start (2007-12) → at least one tick present
    expect(screen.getByTitle("Global financial crisis")).toBeTruthy();
  });

  it("never renders a NaN% tick position for a single-month array", () => {
    const onSeek = vi.fn();
    const onTogglePlay = vi.fn();
    const onFrameMsChange = vi.fn();
    const { container } = render(
      <MomentumMapTimeline
        months={["2026-05-31"]}
        currentFrame={0}
        isPlaying={false}
        frameMs={125}
        size="hero"
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
        onFrameMsChange={onFrameMsChange}
      />,
    );
    const tickSpans =
      container.querySelectorAll<HTMLSpanElement>("span[title]");
    expect(tickSpans.length).toBeGreaterThan(0);
    tickSpans.forEach((span) => {
      expect(span.style.left).toMatch(/^\d+(\.\d+)?%$/);
    });
  });
});

describe("MomentumSummaryStrip", () => {
  // Percentage tiles were replaced 2026-07-11: percentile scores make bucket
  // shares constant every month, so the strip now names the frame's movers.
  const metros = [
    {
      id: "1",
      name: "Hartford-East Hartford, CT",
      lat: 41.7,
      lon: -72.7,
      pop: 1_200_000,
      conf: "A",
    },
    {
      id: "2",
      name: "Punta Gorda, FL",
      lat: 26.9,
      lon: -82.0,
      pop: 200_000,
      conf: "B",
    },
    {
      id: "3",
      name: "Des Moines-West Des Moines, IA",
      lat: 41.5,
      lon: -93.7,
      pop: 737_164,
      conf: "A",
    },
    {
      id: "4",
      name: "No Data Metro, TX",
      lat: 31.0,
      lon: -100.0,
      pop: 50_000,
      conf: null,
    },
  ];
  const scores = [
    [92, 40], // Hartford — leading in month 0
    [8, 41], // Punta Gorda — lagging in month 0
    [55, 92], // Des Moines — leading in month 1
    [0, 0], // no data — excluded from movers and count
  ];

  it("names the frame's leading and lagging metros with momentum labels", () => {
    render(
      <MomentumSummaryStrip scores={scores} currentFrame={0} metros={metros} />,
    );
    const leading = screen.getByTestId("momentum-leading");
    const lagging = screen.getByTestId("momentum-lagging");
    expect(leading.textContent).toContain("Hartford, CT");
    expect(leading.textContent).toContain("92");
    expect(leading.textContent).toContain("VERY STRONG");
    expect(lagging.textContent).toContain("Punta Gorda, FL");
    expect(lagging.textContent).toContain("8");
    expect(lagging.textContent).toContain("VERY WEAK");
  });

  it("recomputes movers per frame and excludes no-data metros from the count", () => {
    render(
      <MomentumSummaryStrip scores={scores} currentFrame={1} metros={metros} />,
    );
    expect(screen.getByTestId("momentum-leading").textContent).toContain(
      "Des Moines, IA",
    );
    // month 1: 40 vs 41 — Hartford is now the lagging metro
    expect(screen.getByTestId("momentum-lagging").textContent).toContain(
      "Hartford, CT",
    );
    expect(screen.getByTestId("momentum-summary-strip").textContent).toContain(
      "3",
    );
  });

  it("breaks score ties toward the larger-population metro", () => {
    const tied = [
      { ...metros[0], pop: 100 },
      { ...metros[1], pop: 5_000_000 },
    ];
    render(
      <MomentumSummaryStrip
        scores={[[70], [70]]}
        currentFrame={0}
        metros={tied}
      />,
    );
    expect(screen.getByTestId("momentum-leading").textContent).toContain(
      "Punta Gorda, FL",
    );
  });
});
