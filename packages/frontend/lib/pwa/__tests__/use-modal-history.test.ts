// packages/frontend/lib/pwa/__tests__/use-modal-history.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useModalHistory } from "../use-modal-history";

// Real jsdom `history.back()` defers its popstate asynchronously across the
// event loop, which would leak into later tests. Every test below controls
// popstate timing explicitly via firePopState(), so back() itself is always
// a no-op spy — we only assert it was *called*, never let it actually run.
beforeEach(() => {
  vi.spyOn(window.history, "back").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

function firePopState() {
  window.dispatchEvent(new PopStateEvent("popstate"));
}

describe("useModalHistory — opening", () => {
  it("pushes a history entry tagged with the modal's id when isOpen flips to true", () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    const onClose = vi.fn();

    const { rerender } = renderHook(
      ({ isOpen }) => useModalHistory(isOpen, onClose, "push-test"),
      { initialProps: { isOpen: false } },
    );
    rerender({ isOpen: true });

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const [state] = pushSpy.mock.calls[0];
    expect(state).toMatchObject({ piqModal: "push-test" });
  });

  it("does not push again on re-renders while isOpen stays true", () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    const onClose = vi.fn();

    const { rerender } = renderHook(
      ({ isOpen }) => useModalHistory(isOpen, onClose, "no-double-push-test"),
      { initialProps: { isOpen: true } },
    );
    rerender({ isOpen: true });
    rerender({ isOpen: true });

    expect(pushSpy).toHaveBeenCalledTimes(1);
  });
});

describe("useModalHistory — system back button (popstate)", () => {
  it("calls onClose exactly once when a popstate pops the pushed entry", () => {
    const onClose = vi.fn();
    renderHook(
      ({ isOpen }) => useModalHistory(isOpen, onClose, "popstate-test"),
      {
        initialProps: { isOpen: true },
      },
    );

    firePopState();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClose for a modal instance that never opened (not on the stack)", () => {
    const onCloseOpen = vi.fn();
    const onCloseNeverOpened = vi.fn();

    renderHook(() => useModalHistory(true, onCloseOpen, "open-modal-a"));
    renderHook(() =>
      useModalHistory(false, onCloseNeverOpened, "never-opened-modal-b"),
    );

    firePopState();

    expect(onCloseOpen).toHaveBeenCalledTimes(1);
    expect(onCloseNeverOpened).not.toHaveBeenCalled();
  });
});

describe("useModalHistory — programmatic close (X / Escape / backdrop)", () => {
  it("consumes its own history entry via history.back(), and the resulting popstate does not double-fire onClose", () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ isOpen }) => useModalHistory(isOpen, onClose, "consume-test"),
      { initialProps: { isOpen: true } },
    );

    // e.g. the user tapped the X button, which flips isOpen to false.
    rerender({ isOpen: false });

    expect(window.history.back).toHaveBeenCalledTimes(1);

    // Simulate the popstate a real back() call would trigger.
    firePopState();

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call history.back() a second time on a subsequent programmatic close of the same modal", () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ isOpen }) => useModalHistory(isOpen, onClose, "reopen-test"),
      { initialProps: { isOpen: true } },
    );

    rerender({ isOpen: false });
    firePopState(); // consumes the entry, as above
    expect(window.history.back).toHaveBeenCalledTimes(1);

    // Re-open and close again — should push + consume independently.
    rerender({ isOpen: true });
    rerender({ isOpen: false });

    expect(window.history.back).toHaveBeenCalledTimes(2);
  });
});

describe("useModalHistory — stacked modals close LIFO", () => {
  it("closes the most-recently-opened modal first when two are stacked", () => {
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();

    const { rerender } = renderHook(
      ({ openA, openB }: { openA: boolean; openB: boolean }) => {
        useModalHistory(openA, onCloseA, "lifo-a");
        useModalHistory(openB, onCloseB, "lifo-b");
      },
      { initialProps: { openA: true, openB: false } },
    );

    rerender({ openA: true, openB: true }); // B opens on top of A

    firePopState();
    expect(onCloseB).toHaveBeenCalledTimes(1);
    expect(onCloseA).not.toHaveBeenCalled();

    // B's real onClose would flip its own isOpen prop false — simulate that.
    rerender({ openA: true, openB: false });

    firePopState();
    expect(onCloseA).toHaveBeenCalledTimes(1);
  });
});

describe("useModalHistory — route changes from inside the modal", () => {
  it("does not call history.back() when the pathname changed while open (a real navigation, e.g. router.push)", () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ isOpen }) => useModalHistory(isOpen, onClose, "route-change-test"),
      { initialProps: { isOpen: true } },
    );

    // e.g. MapContextMenu's "View in Markets" calling router.push() from
    // inside the modal, which itself pushes a new URL onto history.
    window.history.pushState({}, "", "/market/123");

    // The same click also closes the modal.
    rerender({ isOpen: false });

    expect(window.history.back).not.toHaveBeenCalled();
  });
});
