import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimelineScrubber } from "../TimelineScrubber";

const base = {
  min: 0,
  max: 10,
  value: 3,
  onTogglePlay: () => {},
  onScrub: () => {},
  onAdvance: () => {},
  onStop: () => {},
  rangeOptions: [{ months: 24, label: "2Y", active: true, onClick: () => {} }],
  startLabel: "Jul '24",
  midLabel: "Jan '25",
  endLabel: "Jul '26",
  monthLabel: "Apr '25",
};

describe("TimelineScrubber", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the month label and the range preset", () => {
    render(<TimelineScrubber {...base} playing={false} />);
    expect(screen.getByText("Apr '25")).toBeTruthy();
    expect(screen.getByText("2Y")).toBeTruthy();
  });

  it("advances via onAdvance while playing", () => {
    const onAdvance = vi.fn();
    render(<TimelineScrubber {...base} playing onAdvance={onAdvance} />);
    vi.advanceTimersByTime(400);
    expect(onAdvance).toHaveBeenCalledWith(4);
  });

  it("calls onStop when playing at the max frame", () => {
    const onStop = vi.fn();
    render(<TimelineScrubber {...base} value={10} playing onStop={onStop} />);
    vi.advanceTimersByTime(400);
    expect(onStop).toHaveBeenCalled();
  });
});
