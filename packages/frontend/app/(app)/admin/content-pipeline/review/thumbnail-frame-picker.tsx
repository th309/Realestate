"use client";
import { useEffect, useRef, useState } from "react";
import { useRegenerateThumbnail } from "../lib/use-run-mutations";

/**
 * "Pick a frame" pane of the thumbnail editor.
 *
 * The slider drives the underlying <video> element's currentTime so the
 * operator sees exactly what they're picking — no offscreen-canvas trick,
 * just the video frozen at the chosen frame. Submitting POSTs the frame
 * number to the backend; the actual persisted thumbnail is rendered by
 * Remotion (so it includes Audio bursts, transitions, etc. that the
 * preview <video> already shows correctly because it's the rendered file).
 */
export function ThumbnailFramePicker({
  runId,
  videoUrl,
  fps,
  totalFrames,
  onClose,
}: {
  runId: string;
  videoUrl: string | null;
  fps: number;
  totalFrames: number;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frame, setFrame] = useState(210);
  const regenMut = useRegenerateThumbnail();
  const maxFrame = totalFrames - 1;
  const seconds = frame / fps;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
  }, [seconds]);

  function nudge(delta: number) {
    setFrame((f) => Math.max(0, Math.min(maxFrame, f + delta)));
  }

  function handleSubmit() {
    regenMut.mutate({ id: runId, frame }, { onSuccess: () => onClose() });
  }

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="bg-on-surface rounded-2xl overflow-hidden aspect-[9/16] max-h-[55vh] mx-auto w-full">
        {videoUrl ? (
          <video
            ref={videoRef}
            key={videoUrl}
            src={videoUrl}
            muted
            playsInline
            preload="auto"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-on-error-container/70 text-sm">
            No video to scrub yet
          </div>
        )}
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={maxFrame}
          step={1}
          value={frame}
          onChange={(e) => setFrame(parseInt(e.target.value, 10))}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              nudge(e.shiftKey ? -10 : -1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              nudge(e.shiftKey ? 10 : 1);
            }
          }}
          className="w-full accent-primary"
          aria-label="Frame"
        />
        <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant">
          <span>0:00</span>
          <span className="text-on-surface text-sm">
            Frame {frame} · {formatTime(seconds)} · {sceneName(frame)}
          </span>
          <span>{formatTime(maxFrame / fps)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-[11px] font-mono text-on-surface-variant">
          ← / → nudges 1 frame · Shift + arrow nudges 10
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={regenMut.isPending}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-on-surface hover:bg-on-surface/8 disabled:opacity-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={regenMut.isPending || !videoUrl}
            className="px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2 transition-colors duration-200"
          >
            {regenMut.isPending && (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin"
                aria-hidden
              />
            )}
            Use frame {frame}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds * 10) % 10);
  return `${m}:${String(s).padStart(2, "0")}.${ms}`;
}

// Friendly scene-position annotation for grade_reveal at 30fps. Other
// formats fall through to a generic position description; refine when
// each format gets stable scene timings.
function sceneName(frame: number): string {
  if (frame < 60) return "Intro";
  if (frame < 270) return "Inside ScoreReveal";
  if (frame < 510) return "Inside TrendChart";
  if (frame < 780) return "Inside StatCards";
  if (frame < 1080) return "Inside Comparison";
  return "Outro";
}
