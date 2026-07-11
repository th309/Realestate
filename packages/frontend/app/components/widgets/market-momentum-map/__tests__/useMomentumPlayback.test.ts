import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMomentumPlayback } from "../useMomentumPlayback";

describe("useMomentumPlayback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts on the latest frame once frames exist", () => {
    const { result, rerender } = renderHook(
      ({ count }) => useMomentumPlayback(count),
      { initialProps: { count: 0 } },
    );
    rerender({ count: 10 });
    expect(result.current.currentFrame).toBe(9);
    expect(result.current.isPlaying).toBe(false);
  });

  it("play from the latest frame restarts the journey at frame 0", () => {
    const { result } = renderHook(() => useMomentumPlayback(10));
    act(() => result.current.play());
    expect(result.current.currentFrame).toBe(0);
    expect(result.current.isPlaying).toBe(true);
  });

  it("advances one frame per interval and pauses at the end", () => {
    const { result } = renderHook(() => useMomentumPlayback(3));
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(125));
    expect(result.current.currentFrame).toBe(1);
    act(() => vi.advanceTimersByTime(125));
    expect(result.current.currentFrame).toBe(2);
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.currentFrame).toBe(2); // stays on last frame
    expect(result.current.isPlaying).toBe(false);
  });

  it("seek clamps to range and pauses playback", () => {
    const { result } = renderHook(() => useMomentumPlayback(10));
    act(() => result.current.play());
    act(() => result.current.seek(500));
    expect(result.current.currentFrame).toBe(9);
    expect(result.current.isPlaying).toBe(false);
    act(() => result.current.seek(-5));
    expect(result.current.currentFrame).toBe(0);
  });
});
