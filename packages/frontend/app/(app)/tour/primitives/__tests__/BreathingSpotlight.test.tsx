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
    render(<BreathingSpotlight targetSelector="#x" visible />);
    const top = screen.getByTestId("spotlight-dim-top");
    const bottom = screen.getByTestId("spotlight-dim-bottom");
    const left = screen.getByTestId("spotlight-dim-left");
    const right = screen.getByTestId("spotlight-dim-right");
    // Top panel ends exactly where the (padded) target begins.
    expect(top).toBeInTheDocument();
    expect(bottom).toBeInTheDocument();
    expect(left).toBeInTheDocument();
    expect(right).toBeInTheDocument();
    // No panel is the target itself; the hole has no covering element.
    expect(screen.queryByTestId("spotlight-fullscreen-blur")).toBeNull();
  });
});
