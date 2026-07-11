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
  it("shows the three momentum percentages for the current frame", () => {
    const scores = [
      [72], // rising
      [55], // steady
      [41], // easing
      [30], // easing
    ];
    render(<MomentumSummaryStrip scores={scores} currentFrame={0} />);
    // Rising and steady both land on 25% here, so a flat toContain("25%")
    // on the whole strip can't tell the tiles apart — scope each assertion
    // to its own tile (label + percentage together).
    const risingTile = screen
      .getByText("Firming or rising momentum")
      .closest("div");
    const steadyTile = screen
      .getByText("Steady, near state average")
      .closest("div");
    const easingTile = screen
      .getByText("Easing or weak momentum")
      .closest("div");
    expect(risingTile?.textContent).toContain("25%");
    expect(steadyTile?.textContent).toContain("25%");
    expect(easingTile?.textContent).toContain("50%");
  });
});
