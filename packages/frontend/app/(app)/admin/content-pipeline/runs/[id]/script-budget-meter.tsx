"use client";

import type { ScriptBudget } from "../../lib/script-budget";

/**
 * Voice-over length against the format's hard cap.
 *
 * Drawn as the video's own timeline rather than a generic progress bar: the
 * track IS the finished video's duration, the fill is the estimated voice-over,
 * and the striped tail is the audio buffer the script may not spill into. The
 * constraint is a timeline, so the structure carries the meaning instead of
 * decorating it.
 *
 * Framed as an estimate throughout. Only the synthesized MP3's probed length is
 * authoritative (enforce-audio-budget.ts), and speech pace varies with how the
 * TTS voice reads numbers — so the meter reports its own margin rather than
 * pretending to a precision it does not have.
 */
export function ScriptBudgetMeter({
  budget,
  durationSeconds,
}: {
  budget: ScriptBudget;
  /** The finished video's length — the full width of the track. */
  durationSeconds: number;
}) {
  const over = budget.overBySeconds > 0;
  const pct = (seconds: number) =>
    `${Math.min(100, Math.max(0, (seconds / durationSeconds) * 100))}%`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-mono text-2xl font-medium tabular-nums ${
              over ? "text-error" : "text-on-surface"
            }`}
          >
            {budget.estimatedSeconds.toFixed(1)}s
          </span>
          <span className="text-sm text-on-surface-variant">
            of {budget.capSeconds.toFixed(1)}s
          </span>
        </div>
        {over ? (
          <span className="rounded-full bg-error-container px-3 py-1 font-mono text-xs font-semibold text-on-surface">
            {budget.overBySeconds.toFixed(1)}s over
          </span>
        ) : (
          <span className="font-mono text-xs text-on-surface-variant">
            {(budget.capSeconds - budget.estimatedSeconds).toFixed(1)}s spare
          </span>
        )}
      </div>

      <div
        className="relative h-3 w-full overflow-hidden rounded-full bg-surface-container-high"
        role="img"
        aria-label={`Voice-over runs about ${budget.estimatedSeconds.toFixed(1)} seconds against a ${budget.capSeconds.toFixed(1)} second cap`}
      >
        {/* Buffer zone: real video time the voice-over must leave empty. */}
        <div
          className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,currentColor_3px,currentColor_4px)] text-outline"
          style={{ left: pct(budget.capSeconds) }}
        />
        {/* Speech, then inserted silence — silence is exact, speech is not. */}
        <div
          className={`absolute inset-y-0 left-0 ${over ? "bg-error" : "bg-primary"}`}
          style={{ width: pct(budget.speechSeconds) }}
        />
        <div
          className={`absolute inset-y-0 ${over ? "bg-error/50" : "bg-primary/50"}`}
          style={{
            left: pct(budget.speechSeconds),
            width: pct(budget.pauseSeconds),
          }}
        />
        <div
          className="absolute inset-y-0 w-px bg-on-surface"
          style={{ left: pct(budget.capSeconds) }}
        />
      </div>

      <p className="text-xs text-on-surface-variant">
        Estimated: {budget.speechSeconds.toFixed(1)}s speaking +{" "}
        {budget.pauseSeconds.toFixed(1)}s of pauses across {budget.segmentCount}{" "}
        {budget.segmentCount === 1 ? "clip" : "clips"}. The recorded voice-over
        decides the real length.
      </p>
    </div>
  );
}
