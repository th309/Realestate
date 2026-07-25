"use client";
import React from "react";
import { TimelineScrubber } from "./TimelineScrubber";
import { RANGE_PRESETS } from "../lib/explorer-config";
import { monthLabelOf } from "../lib/explorer-labels";
import type { ExplorerAction } from "../lib/explorer-reducer";
import type { ExplorerState } from "../lib/explorer-config";

export interface ExplorerTimelineProps {
  state: ExplorerState;
  dispatch: (action: ExplorerAction) => void;
  dates: string[];
  windowStart: number;
  lastIdx: number;
  monthIndex: number;
}

export function ExplorerTimeline({
  state,
  dispatch,
  dates,
  windowStart,
  lastIdx,
  monthIndex,
}: ExplorerTimelineProps) {
  return (
    <TimelineScrubber
      min={windowStart}
      max={lastIdx}
      value={monthIndex}
      playing={state.playing}
      onTogglePlay={() => {
        // By design the page lands on the latest SCORED month by default (so
        // it shows CURRENT data first, not history) — which is always at or
        // one before the window's true end (raw data can lag score
        // publication by a month). Play's job is the opposite: travel back
        // through history. So starting playback always rewinds to the start
        // of whichever timeline range is currently selected (windowStart)
        // and animates forward from there — not a resume-from-wherever
        // control. This also means switching the range preset (SET_RANGE,
        // which doesn't itself clamp monthIndex) can never leave Play
        // starting from a stale/out-of-window position, since it always
        // re-derives windowStart fresh.
        if (!state.playing) {
          dispatch({ type: "SET_MONTH", monthIndex: windowStart });
        }
        dispatch({ type: "TOGGLE_PLAY" });
      }}
      onScrub={(v) => {
        dispatch({ type: "SET_MONTH", monthIndex: v });
        dispatch({ type: "SET_PLAYING", playing: false });
      }}
      onAdvance={(v) => dispatch({ type: "SET_MONTH", monthIndex: v })}
      onStop={() => dispatch({ type: "SET_PLAYING", playing: false })}
      rangeOptions={RANGE_PRESETS.map((r) => ({
        months: r.months,
        label: r.label,
        active: state.range === r.months,
        onClick: () => dispatch({ type: "SET_RANGE", range: r.months }),
      }))}
      startLabel={monthLabelOf(dates[windowStart])}
      midLabel={monthLabelOf(dates[Math.round((windowStart + lastIdx) / 2)])}
      endLabel={monthLabelOf(dates[lastIdx])}
      monthLabel={monthLabelOf(dates[monthIndex])}
    />
  );
}
