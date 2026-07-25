import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExplorerTimeline } from "../ExplorerTimeline";
import { initialExplorerState } from "../../lib/explorer-reducer";

const dates = Array.from(
  { length: 24 },
  (_, i) => `2024-${String((i % 12) + 1).padStart(2, "0")}-01`,
);

// windowStart is non-zero so these tests actually prove playback rewinds to
// the start of the SELECTED range, not just to index 0 coincidentally.
const base = {
  dates,
  windowStart: 5,
  lastIdx: 23,
};

describe("ExplorerTimeline — Play always restarts the selected timeline from its start", () => {
  it("rewinds to windowStart when starting from the last frame — the 'nothing plays' bug", () => {
    const dispatch = vi.fn();
    render(
      <ExplorerTimeline
        {...base}
        state={{ ...initialExplorerState, playing: false }}
        dispatch={dispatch}
        monthIndex={23} // === lastIdx, the default "show current data" landing spot
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /play timeline/i }));
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_MONTH",
      monthIndex: 5,
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "TOGGLE_PLAY" });
  });

  it("also rewinds to windowStart when starting from anywhere mid-range — Play is always a full replay of the current timeline, not a resume-from-wherever control", () => {
    const dispatch = vi.fn();
    render(
      <ExplorerTimeline
        {...base}
        state={{ ...initialExplorerState, playing: false }}
        dispatch={dispatch}
        monthIndex={15}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /play timeline/i }));
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_MONTH",
      monthIndex: 5,
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "TOGGLE_PLAY" });
  });

  it("rewinds even when sitting exactly at windowStart — a harmless no-op SET_MONTH, then plays", () => {
    const dispatch = vi.fn();
    render(
      <ExplorerTimeline
        {...base}
        state={{ ...initialExplorerState, playing: false }}
        dispatch={dispatch}
        monthIndex={5}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /play timeline/i }));
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_MONTH",
      monthIndex: 5,
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "TOGGLE_PLAY" });
  });

  it("does NOT rewind when pausing (already playing)", () => {
    const dispatch = vi.fn();
    render(
      <ExplorerTimeline
        {...base}
        state={{ ...initialExplorerState, playing: true }}
        dispatch={dispatch}
        monthIndex={15}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /pause timeline/i }));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "SET_MONTH" }),
    );
    expect(dispatch).toHaveBeenCalledWith({ type: "TOGGLE_PLAY" });
  });
});
