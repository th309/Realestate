import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useDealAutosave,
  AUTOSAVE_DEBOUNCE_MS,
  MAX_CONSECUTIVE_FAILURES,
} from "../use-deal-autosave";
import type { DealStateV2 } from "../deal-state-types";

const patchDealState = vi.fn();
vi.mock("@/lib/data", () => ({
  patchDealState: (...a: unknown[]) => patchDealState(...a),
}));

// Deliberately a partial fixture — a double cast (never full field coverage
// of AnalyzerInputState) keeps the test focused on debounce/status behavior
// rather than on constructing a complete DealStateV2.
const STATE = {
  v: 2,
  input: { price: 300000 },
} as unknown as DealStateV2;

describe("useDealAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    patchDealState.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not save on the initial render — hydration is not an edit", () => {
    renderHook(() =>
      useDealAutosave({ dealId: "row-1", state: STATE, enabled: true }),
    );
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 3);
    });
    expect(patchDealState).not.toHaveBeenCalled();
  });

  it("does not save when there is no row yet", () => {
    const { rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: null, state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );
    rerender({
      s: { ...STATE, input: { price: 310000 } } as unknown as DealStateV2,
    });
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    expect(patchDealState).not.toHaveBeenCalled();
  });

  it("debounces a burst of edits into one request", () => {
    const { rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: "row-1", state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );
    for (const price of [310000, 320000, 330000]) {
      rerender({
        s: { ...STATE, input: { price } } as unknown as DealStateV2,
      });
      act(() => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS / 4);
      });
    }
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(patchDealState).toHaveBeenCalledTimes(1);
    expect(patchDealState.mock.calls[0][1].input.price).toBe(330000);
  });

  it("reports saved after a successful write", async () => {
    const { result, rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: "row-1", state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );
    rerender({
      s: { ...STATE, input: { price: 310000 } } as unknown as DealStateV2,
    });
    // Fake timers are active, so waitFor's own internal poll (which relies on
    // a real setTimeout) would never fire — assert directly once the flush's
    // pending promise has had a chance to settle. See OtpCodeForm.test.tsx
    // for the same pattern elsewhere in this repo.
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("saved");
  });

  it("reports error and stops after MAX_CONSECUTIVE_FAILURES", async () => {
    patchDealState.mockRejectedValue(new Error("500"));
    const { result, rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: "row-1", state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );
    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES + 2; i++) {
      rerender({
        s: { ...STATE, input: { price: 300000 + i } } as unknown as DealStateV2,
      });
      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      });
    }
    expect(result.current.status).toBe("error");
    expect(patchDealState.mock.calls.length).toBeLessThanOrEqual(
      MAX_CONSECUTIVE_FAILURES,
    );
  });
});
