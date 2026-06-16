import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { ConnectedTooltip } from "../ConnectedTooltip";

function setReducedMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (q: string) => ({
      matches: reduced && q.includes("reduced-motion"),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe("ConnectedTooltip", () => {
  it("uses no scale/translate transform when reduced-motion is requested", () => {
    setReducedMotion(true);
    const step = {
      id: "s",
      route: null,
      targetSelector: null,
      title: "T",
      body: "B",
      placement: "center" as const,
      allowManualAdvance: true,
    };
    const { container } = render(
      <ConnectedTooltip
        step={step}
        currentIndex={0}
        totalSteps={3}
        onDismiss={() => {}}
        onContinue={() => {}}
      />,
    );
    const card = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(card.style.transform).toBe("none");
  });

  it("keeps the dismiss grace timer running through re-renders (button appears ~10s after mount)", () => {
    vi.useFakeTimers();
    setReducedMotion(false);
    const baseStep = {
      id: "s1",
      route: null,
      targetSelector: null,
      title: "T",
      body: "B",
      placement: "center" as const,
      allowManualAdvance: true,
    };
    const renderProps = () => ({
      step: { ...baseStep },
      currentIndex: 0,
      totalSteps: 3,
      onDismiss: () => {},
      onContinue: () => {},
    });
    const { rerender, queryByText } = render(
      <ConnectedTooltip {...renderProps()} />,
    );
    // 6s into the 10s grace, then simulate parent re-render churn with a fresh
    // step object identity. This used to restart the timer (it lived in the
    // position effect); with the fix the grace is immune to re-renders.
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    rerender(<ConnectedTooltip {...renderProps()} />);
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(queryByText("Do this later")).not.toBeNull();
    vi.useRealTimers();
  });
});
