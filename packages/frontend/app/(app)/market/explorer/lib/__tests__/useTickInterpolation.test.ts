import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTickInterpolation } from "../useTickInterpolation";

// Deterministic, manually-driven rAF + performance.now mocks — avoids
// ambiguity in how Vitest's built-in fake timers coordinate the two.
function useRafMocks() {
  let rafQueue: FrameRequestCallback[] = [];
  let now = 0;
  beforeEach(() => {
    rafQueue = [];
    now = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(performance, "now").mockImplementation(() => now);
  });
  afterEach(() => vi.restoreAllMocks());
  return {
    advance(ms: number) {
      now += ms;
      act(() => {
        const pending = rafQueue;
        rafQueue = [];
        pending.forEach((cb) => cb(now));
      });
    },
    queueLength: () => rafQueue.length,
  };
}

describe("useTickInterpolation", () => {
  const raf = useRafMocks();

  it("never calls onFrame or schedules a frame while inactive", () => {
    const onFrame = vi.fn();
    renderHook(() => useTickInterpolation(false, "key-a", onFrame));
    raf.advance(1000);
    expect(onFrame).not.toHaveBeenCalled();
    expect(raf.queueLength()).toBe(0);
  });

  it("calls onFrame with a fraction advancing from 0 toward 1 over AUTOPLAY_TICK_MS (380ms)", () => {
    const onFrame = vi.fn();
    renderHook(() => useTickInterpolation(true, "key-a", onFrame));

    raf.advance(190); // halfway
    expect(onFrame).toHaveBeenLastCalledWith(expect.closeTo(0.5, 5));

    raf.advance(190); // full tick
    expect(onFrame).toHaveBeenLastCalledWith(1);
  });

  it("stops scheduling further frames once t reaches 1", () => {
    const onFrame = vi.fn();
    renderHook(() => useTickInterpolation(true, "key-a", onFrame));
    raf.advance(1000); // way past a full tick
    expect(onFrame).toHaveBeenLastCalledWith(1);
    expect(raf.queueLength()).toBe(0);
  });

  it("calls onFrame(0) when `active` becomes false (pause) so the DOM resets to the exact baseline — without this, pausing mid-blend would leave a stale interpolated value stuck since nothing else would rewrite it", () => {
    const onFrame = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => useTickInterpolation(active, "key-a", onFrame),
      { initialProps: { active: true } },
    );
    raf.advance(100); // mid-blend, not yet at t=1
    onFrame.mockClear();

    act(() => {
      rerender({ active: false });
    });
    expect(onFrame).toHaveBeenCalledWith(0);
  });

  it("restarts the blend from 0 when resetKey changes while still active — a new tick begins", () => {
    const onFrame = vi.fn();
    const { rerender } = renderHook(
      ({ resetKey }) => useTickInterpolation(true, resetKey, onFrame),
      { initialProps: { resetKey: "month-0" } },
    );
    raf.advance(380); // reach t=1 for the first tick
    expect(onFrame).toHaveBeenLastCalledWith(1);
    onFrame.mockClear();

    act(() => {
      rerender({ resetKey: "month-1" });
    });
    // The new tick advances fresh from 0.
    raf.advance(190);
    expect(onFrame).toHaveBeenLastCalledWith(expect.closeTo(0.5, 5));
  });

  it("does NOT replay a reset through the PREVIOUS tick's closure when resetKey changes while still active — regression test for a real bug caught in review: React flushes every effect's cleanup before any effect's setup, so a reset-on-cleanup here fired via a still-stale ref (pointing at the outgoing tick's `onFrame`), stomping the just-painted new baseline with the old tick's values for one frame, every ~380ms, throughout autoplay", () => {
    const onFrameMonth0 = vi.fn();
    const onFrameMonth1 = vi.fn();
    const { rerender } = renderHook(
      ({ resetKey, onFrame }) => useTickInterpolation(true, resetKey, onFrame),
      { initialProps: { resetKey: "month-0", onFrame: onFrameMonth0 } },
    );
    raf.advance(380); // reach t=1 for the first tick
    expect(onFrameMonth0).toHaveBeenLastCalledWith(1);

    act(() => {
      rerender({ resetKey: "month-1", onFrame: onFrameMonth1 });
    });
    // The OUTGOING tick's closure must never be called again — especially
    // not with 0, which would mean the old month's baseline got replayed
    // over the DOM after the new month's baseline already painted.
    expect(onFrameMonth0).not.toHaveBeenCalledWith(0);
    expect(onFrameMonth0).toHaveBeenCalledTimes(1); // still just the t=1 call from before

    // The new tick's first write comes from its own fresh closure.
    raf.advance(190);
    expect(onFrameMonth1).toHaveBeenLastCalledWith(expect.closeTo(0.5, 5));
  });
});
