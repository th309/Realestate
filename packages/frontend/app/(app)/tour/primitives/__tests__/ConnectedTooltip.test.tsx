import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
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
});
