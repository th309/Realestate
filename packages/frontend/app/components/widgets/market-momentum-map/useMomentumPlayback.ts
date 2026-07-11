"use client";

/**
 * Frame state for the Market Momentum Map's monthly playback. Speeds are
 * widget-specific (~8 months/sec at 1x — the full 305-month journey runs in
 * ~38s) which is why this doesn't reuse PlaybackControls' 1600-200ms range.
 */

import { useCallback, useEffect, useState } from "react";

export const PLAYBACK_SPEEDS = [
  { label: "0.5x", frameMs: 250 },
  { label: "1x", frameMs: 125 },
  { label: "2x", frameMs: 62 },
] as const;

export interface MomentumPlayback {
  currentFrame: number;
  isPlaying: boolean;
  frameMs: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (frame: number) => void;
  setFrameMs: (ms: number) => void;
  prefersReducedMotion: boolean;
}

export function useMomentumPlayback(frameCount: number): MomentumPlayback {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameMs, setFrameMs] = useState<number>(125);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Land on the latest month once data arrives.
  useEffect(() => {
    if (frameCount > 0) setCurrentFrame(frameCount - 1);
  }, [frameCount]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!isPlaying || frameCount <= 0) return;
    const id = window.setInterval(() => {
      setCurrentFrame((frame) => {
        if (frame + 1 >= frameCount) {
          setIsPlaying(false);
          return frame;
        }
        return frame + 1;
      });
    }, frameMs);
    return () => window.clearInterval(id);
  }, [isPlaying, frameMs, frameCount]);

  const play = useCallback(() => {
    // Pressing play while parked on "today" restarts the 25-year journey.
    setCurrentFrame((frame) =>
      frameCount > 0 && frame >= frameCount - 1 ? 0 : frame,
    );
    setIsPlaying(true);
  }, [frameCount]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const togglePlay = useCallback(
    () => (isPlaying ? pause() : play()),
    [isPlaying, pause, play],
  );

  const seek = useCallback(
    (frame: number) => {
      setIsPlaying(false);
      setCurrentFrame(
        Math.max(0, Math.min(frame, Math.max(0, frameCount - 1))),
      );
    },
    [frameCount],
  );

  return {
    currentFrame,
    isPlaying,
    frameMs,
    play,
    pause,
    togglePlay,
    seek,
    setFrameMs,
    prefersReducedMotion,
  };
}
