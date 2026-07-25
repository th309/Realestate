import { useEffect, useRef } from "react";
import { AUTOPLAY_TICK_MS } from "../components/TimelineScrubber";

/**
 * Drives a per-frame blend directly via requestAnimationFrame, bypassing
 * React state/re-render entirely — mirrors how the graphs page's D3 scatter
 * race drives cx/cy/fill via `.transition()` (a timer that writes DOM
 * attributes directly), not through a UI framework's virtual-DOM diffing.
 *
 * The previous approach pushed every animation frame through a React
 * `setState`, forcing a full reconciliation of up to 935 SVG elements on
 * every tick; even throttled to ~24fps, that reconciliation cost made frame
 * pacing irregular — which read as "snapping"/jerky motion despite
 * mathematically correct interpolation values. Direct attribute writes
 * (what `onFrame` is expected to do) have no such cost, so this runs
 * uncapped at native rAF cadence.
 *
 * `onFrame(t)` fires with the blend fraction (0 at tick start, 1 at
 * AUTOPLAY_TICK_MS) every animation frame while `active`. When `active`
 * becomes false (pause, or unmount), `onFrame(0)` fires once more so the DOM
 * settles back to EXACTLY what the caller's own baseline (t=0) render would
 * show — without this, React can bail out of re-writing an attribute whose
 * prop value didn't change (pausing mid-tick with the same current-month
 * baseline), leaving a stale mid-blend value stuck on screen.
 *
 * That reset deliberately does NOT fire when only `resetKey` changes while
 * `active` stays true (a new tick starting during continuous autoplay).
 * React flushes ALL effect cleanups for a commit before running ANY effect
 * setups, so a cleanup here would call back through `onFrameRef` before the
 * ref-sync effect below has updated it for this render — i.e. it would
 * replay the PREVIOUS tick's now-stale baseline over the DOM, one frame
 * after React already committed and painted the new tick's correct
 * baseline. That produced a real one-frame "snap back, then forward" at
 * every ~380ms tick boundary throughout autoplay — caught by code review,
 * not by the original tests (which never modeled two distinct `onFrame`
 * closures across a resetKey change). The new tick's own first rAF frame
 * (using the freshly-synced ref) is the correct first write; no reset call
 * is needed for this case since the JSX baseline already repainted it.
 */
export function useTickInterpolation(
  active: boolean,
  resetKey: unknown,
  onFrame: (t: number) => void,
): void {
  const onFrameRef = useRef(onFrame);
  // Sync the ref in an effect, not during render — this codebase's
  // React Compiler-oriented lint rules disallow writing ref.current in the
  // render body, even for this otherwise-standard "keep the latest callback"
  // pattern. Runs after every render (no dep array) so the rAF loop below
  // always calls the freshest `onFrame` without needing it as an effect dep
  // (which would restart the loop on every unrelated re-render).
  useEffect(() => {
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / AUTOPLAY_TICK_MS);
      onFrameRef.current(t);
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, resetKey]);

  // Separate effect, keyed ONLY on `active` — fires exactly once when
  // playback TRANSITIONS to stopped (not on every resetKey-driven tick
  // restart, and not on initial mount already-inactive: `wasActiveRef`
  // distinguishes "just paused" from "never was playing", since a bare
  // `[active]` dep fires this effect's body on mount too, whether or not
  // `active` actually changed from anything). Reads `onFrame` directly (not
  // the ref): this render's own closure is already the correct one to reset
  // with, no staleness concern here since nothing about this specific
  // effect depends on ordering against the loop above.
  const wasActiveRef = useRef(active);
  useEffect(() => {
    if (!active && wasActiveRef.current) onFrame(0);
    wasActiveRef.current = active;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally reacts to `active` only; `onFrame` is read fresh each call, not stale
  }, [active]);
}
