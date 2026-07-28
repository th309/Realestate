import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { EASINGS, SPRINGS, SpringPreset } from "./presets";

/** Spring progress (0→1 with preset physics) starting `delay` frames in. */
export function useSpringProgress(opts?: {
  delay?: number;
  preset?: SpringPreset;
}): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - (opts?.delay ?? 0),
    fps,
    config: SPRINGS[opts?.preset ?? "entrance"],
  });
}

/**
 * Spring-driven number counter — the value a score/stat readout should
 * display this frame. Heavy `counter` physics by default: fast ramp, long
 * deceleration into the target, no overshoot past it.
 */
export function useCounterValue(
  target: number,
  opts?: { delay?: number; from?: number; preset?: SpringPreset },
): number {
  const progress = useSpringProgress({
    delay: opts?.delay,
    preset: opts?.preset ?? "counter",
  });
  const from = opts?.from ?? 0;
  return from + (target - from) * progress;
}

/**
 * Scripted (non-bouncy) progress between two frames with a brand easing
 * curve — the ONLY sanctioned wrapper for time-ranged interpolate().
 * Camera pans, wipes, background shifts. Defaults to M3 standard easing.
 */
export function useScriptedProgress(
  startFrame: number,
  endFrame: number,
  easing: keyof typeof EASINGS = "standard",
): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, endFrame], [0, 1], {
    easing: EASINGS[easing],
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
