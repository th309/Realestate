import { StrictMode } from "react";
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

const withPrice = (price: number) =>
  ({ ...STATE, input: { price } }) as unknown as DealStateV2;

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
    rerender({ s: withPrice(310000) });
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    expect(patchDealState).not.toHaveBeenCalled();
  });

  it("debounces a burst of edits into one request", async () => {
    const { rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: "row-1", state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );
    for (const price of [310000, 320000, 330000]) {
      rerender({ s: withPrice(price) });
      act(() => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS / 4);
      });
    }
    // Async + a microtask flush: the final advance fires the flush, whose
    // resolution (setStatus) would otherwise land outside any act() call.
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(patchDealState).toHaveBeenCalledTimes(1);
    expect(patchDealState.mock.calls[0][1].input.price).toBe(330000);
  });

  it("reports saved after a successful write", async () => {
    const { result, rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: "row-1", state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );
    rerender({ s: withPrice(310000) });
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
      rerender({ s: withPrice(300000 + i) });
      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      });
    }
    expect(result.current.status).toBe("error");
    expect(patchDealState.mock.calls.length).toBeLessThanOrEqual(
      MAX_CONSECUTIVE_FAILURES,
    );
  });

  it("does not save under StrictMode's double-invoked mount effect", () => {
    renderHook(
      () => useDealAutosave({ dealId: "row-1", state: STATE, enabled: true }),
      { wrapper: StrictMode },
    );
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 3);
    });
    expect(patchDealState).not.toHaveBeenCalled();
  });

  it("does not starve on content-identical re-renders, and saves exactly once when a field actually changes", async () => {
    const { rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: "row-1", state: s, enabled: true }),
      { initialProps: { s: withPrice(300000) } },
    );
    // A caller that rebuilds `state` every render (streaming text, count-up
    // animations) must not be mistaken for an edit — 10 re-renders, each a
    // brand new object with the SAME content, well past the debounce window.
    for (let i = 0; i < 10; i++) {
      rerender({ s: withPrice(300000) });
      act(() => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
      });
    }
    expect(patchDealState).not.toHaveBeenCalled();

    rerender({ s: withPrice(310000) });
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(patchDealState).toHaveBeenCalledTimes(1);
  });

  it("does not advance the saved baseline on a failed write, so an identical retry stays dirty", async () => {
    patchDealState.mockRejectedValueOnce(new Error("500"));
    const { result, rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: "row-1", state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );

    rerender({ s: withPrice(310000) });
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("error");
    expect(patchDealState).toHaveBeenCalledTimes(1);

    // Same content, freshly constructed object — must still read as dirty:
    // the failed write above must not have moved the baseline forward.
    rerender({ s: withPrice(310000) });
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(patchDealState).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });

  it("keeps the freshest write authoritative when an older in-flight save resolves after a newer one", async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<void>((resolve) => {
      resolveSecond = resolve;
    });
    patchDealState.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const { result, rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: "row-1", state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );

    // First edit's debounce fires and starts an in-flight PATCH.
    rerender({ s: withPrice(310000) });
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(patchDealState).toHaveBeenCalledTimes(1);

    // Second edit's debounce fires and starts ITS OWN PATCH while the first
    // is still pending — the real-world overlap under network latency.
    rerender({ s: withPrice(320000) });
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(patchDealState).toHaveBeenCalledTimes(2);

    // The newer request resolves first.
    await act(async () => {
      resolveSecond();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("saved");

    // The older, now-superseded request resolves after it. It must not win.
    await act(async () => {
      resolveFirst();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("saved");

    // Proof, not just assertion: if the stale response HAD rolled the saved
    // baseline back to the 310000 fingerprint, this re-render of the already
    // -saved 320000 content would read as dirty and re-fire a save.
    patchDealState.mockClear();
    rerender({ s: withPrice(320000) });
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(patchDealState).not.toHaveBeenCalled();
  });

  it("does not apply a slow flush's status after the hook has moved to a different dealId", async () => {
    let resolveDealA!: () => void;
    const dealAWrite = new Promise<void>((resolve) => {
      resolveDealA = resolve;
    });
    patchDealState.mockReturnValueOnce(dealAWrite);

    const { result, rerender } = renderHook(
      ({ id, s }) => useDealAutosave({ dealId: id, state: s, enabled: true }),
      { initialProps: { id: "deal-a", s: STATE } },
    );

    rerender({ id: "deal-a", s: withPrice(310000) });
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(result.current.status).toBe("saving");

    // Move to a different deal before deal A's slow write resolves.
    rerender({ id: "deal-b", s: STATE });

    await act(async () => {
      resolveDealA();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Deal A's write finishing must not paint deal B's status "saved".
    expect(result.current.status).not.toBe("saved");
  });
});
