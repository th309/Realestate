import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTourFromUrl } from "../hooks/useTourFromUrl";

const pushSpy = vi.fn();
let currentParams = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(currentParams),
  useRouter: () => ({ push: pushSpy }),
}));

describe("useTourFromUrl", () => {
  beforeEach(() => {
    pushSpy.mockClear();
    currentParams = "";
  });

  it("returns null active when no tour param", () => {
    currentParams = "";
    const { result } = renderHook(() => useTourFromUrl());
    expect(result.current.active).toBe(null);
  });

  it("returns null when tour param is set but market or sessionId missing", () => {
    currentParams = "tour=step1&persona=agent";
    const { result } = renderHook(() => useTourFromUrl());
    expect(result.current.active).toBe(null);
  });

  it("returns null on unknown step id", () => {
    currentParams =
      "tour=step99&persona=agent&market=metro-39580&sessionId=abc";
    const { result } = renderHook(() => useTourFromUrl());
    expect(result.current.active).toBe(null);
  });

  it("hydrates stepId, persona, market, sessionId on valid URL", () => {
    currentParams = "tour=step1&persona=agent&market=metro-39580&sessionId=abc";
    const { result } = renderHook(() => useTourFromUrl());
    expect(result.current.active?.stepId).toBe("step1");
    expect(result.current.active?.persona).toBe("agent");
    expect(result.current.active?.market.geoLevel).toBe("metro");
    expect(result.current.active?.market.geoId).toBe("39580");
    expect(result.current.active?.sessionId).toBe("abc");
  });

  it("normalizes cbsa-* market params to geoLevel:metro (alias)", () => {
    currentParams = "tour=step1&persona=agent&market=cbsa-39580&sessionId=abc";
    const { result } = renderHook(() => useTourFromUrl());
    expect(result.current.active?.market.geoLevel).toBe("metro");
  });

  it("returns null when market param has invalid geoLevel prefix", () => {
    currentParams = "tour=step1&persona=agent&market=bogus-39580&sessionId=abc";
    const { result } = renderHook(() => useTourFromUrl());
    expect(result.current.active).toBe(null);
  });

  it("advance() pushes /market/<geoId>?tour=step2&... when current is step1", () => {
    currentParams = "tour=step1&persona=agent&market=metro-39580&sessionId=abc";
    const { result } = renderHook(() => useTourFromUrl());
    act(() => result.current.advance());
    expect(pushSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\/market\/39580\?.*tour=step2/),
    );
  });

  it("advance() pushes /compare/markets?tour=step3&... when current is step2", () => {
    currentParams = "tour=step2&persona=agent&market=metro-39580&sessionId=abc";
    const { result } = renderHook(() => useTourFromUrl());
    act(() => result.current.advance());
    expect(pushSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\/compare\/markets\?.*tour=step3/),
    );
  });

  it("advance() at step3 does not push (terminal — caller uses advanceToStep4)", () => {
    currentParams = "tour=step3&persona=agent&market=metro-39580&sessionId=abc";
    const { result } = renderHook(() => useTourFromUrl());
    act(() => result.current.advance());
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("advanceToStep4() pushes /tour?phase=step4&...", () => {
    currentParams = "tour=step3&persona=agent&market=metro-39580&sessionId=abc";
    const { result } = renderHook(() => useTourFromUrl());
    act(() => result.current.advanceToStep4());
    expect(pushSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\/tour\?.*phase=step4/),
    );
  });

  it("dismiss() pushes /", () => {
    currentParams = "tour=step1&persona=agent&market=metro-39580&sessionId=abc";
    const { result } = renderHook(() => useTourFromUrl());
    act(() => result.current.dismiss());
    expect(pushSpy).toHaveBeenCalledWith("/");
  });
});
