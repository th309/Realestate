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
    const strip = screen.getByTestId("momentum-summary-strip");
    expect(strip.textContent).toContain("25%"); // rising
    expect(strip.textContent).toContain("50%"); // easing
    expect(strip.textContent).toContain("Firming or rising momentum");
    expect(strip.textContent).toContain("Steady, near state average");
    expect(strip.textContent).toContain("Easing or weak momentum");
  });
});
