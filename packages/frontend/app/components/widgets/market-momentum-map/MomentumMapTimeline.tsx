"use client";

/**
 * Playback controls for the Market Momentum Map: play/pause, month scrubber
 * with era tick marks, and (hero size) a speed selector. Native range input
 * gives keyboard scrubbing (arrows step a month, Home/End jump) for free.
 */

import { Pause, Play } from "lucide-react";
import { eraTickIndices } from "./market-eras";
import { PLAYBACK_SPEEDS } from "./useMomentumPlayback";

export function formatMonthLabel(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    "en-US",
    { month: "short", year: "numeric", timeZone: "UTC" },
  );
}

interface MomentumMapTimelineProps {
  months: string[];
  currentFrame: number;
  isPlaying: boolean;
  frameMs: number;
  size: "hero" | "card";
  onTogglePlay: () => void;
  onSeek: (frame: number) => void;
  onFrameMsChange: (ms: number) => void;
}

export function MomentumMapTimeline({
  months,
  currentFrame,
  isPlaying,
  frameMs,
  size,
  onTogglePlay,
  onSeek,
  onFrameMsChange,
}: MomentumMapTimelineProps) {
  if (months.length === 0) return null;
  const maxFrame = months.length - 1;
  const ticks = eraTickIndices(months);

  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        type="button"
        aria-label={isPlaying ? "Pause" : "Play 25 years of market history"}
        onClick={onTogglePlay}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors duration-200 hover:bg-primary/90"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-[1px]" />
        )}
      </button>
      <div className="relative flex-1">
        <div className="pointer-events-none absolute -top-1.5 left-0 right-0 h-2">
          {ticks.map((tick) => (
            <span
              key={tick.label}
              title={tick.label}
              className="absolute h-2 w-[2px] rounded-full bg-outline"
              style={{ left: `${(tick.index / maxFrame) * 100}%` }}
            />
          ))}
        </div>
        <input
          type="range"
          aria-label="Month"
          aria-valuetext={formatMonthLabel(months[currentFrame])}
          min={0}
          max={maxFrame}
          value={currentFrame}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="w-full accent-primary"
        />
      </div>
      {size === "hero" && (
        <select
          aria-label="Playback speed"
          value={frameMs}
          onChange={(event) => onFrameMsChange(Number(event.target.value))}
          className="rounded-lg border border-outline-variant bg-surface-container px-2 py-1 text-sm text-on-surface"
        >
          {PLAYBACK_SPEEDS.map((speed) => (
            <option key={speed.frameMs} value={speed.frameMs}>
              {speed.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
