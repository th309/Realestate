import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BreathingSpotlight } from "../BreathingSpotlight";

const TARGET = { top: 100, left: 200, width: 300, height: 80 };

beforeEach(() => {
  // jsdom has no layout; give the queried element a known rect.
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    top: TARGET.top,
    left: TARGET.left,
    width: TARGET.width,
    height: TARGET.height,
    right: TARGET.left + TARGET.width,
    bottom: TARGET.top + TARGET.height,
    x: TARGET.left,
    y: TARGET.top,
    toJSON: () => ({}),
  })) as unknown as typeof Element.prototype.getBoundingClientRect;
  // jsdom does not implement scrollIntoView; the component calls it after measuring.
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(document, "querySelector").mockImplementation(() =>
    document.createElement("div"),
  );
});

describe("BreathingSpotlight", () => {
  it("renders four dim panels and leaves the target rect uncovered", () => {
    const { container } = render(
      <BreathingSpotlight targetSelector="#x" visible />,
    );
    expect(screen.getByTestId("spotlight-dim-top")).toBeInTheDocument();
    expect(screen.getByTestId("spotlight-dim-bottom")).toBeInTheDocument();
    expect(screen.getByTestId("spotlight-dim-left")).toBeInTheDocument();
    expect(screen.getByTestId("spotlight-dim-right")).toBeInTheDocument();
    // Exactly four dim panels tile AROUND the target — there is no panel
    // covering the target rect itself (the old full-screen blur is gone).
    expect(
      container.querySelectorAll('[data-testid^="spotlight-dim-"]'),
    ).toHaveLength(4);
  });

  it("calls onTargetMissing (and renders nothing) when the target never appears", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "querySelector").mockReturnValue(null); // target never found
    const onTargetMissing = vi.fn();
    const { container } = render(
      <BreathingSpotlight
        targetSelector="#missing"
        visible
        onTargetMissing={onTargetMissing}
      />,
    );
    // Exhaust the poll (the guard fires once attempts > 20, i.e. the 21st tick).
    await vi.advanceTimersByTimeAsync(21 * 200 + 50);
    expect(onTargetMissing).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-testid="spotlight-dim-top"]'),
    ).toBeNull();
    vi.useRealTimers();
  });
});
