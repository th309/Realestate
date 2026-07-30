/**
 * NavigationSankey rendering and accessibility.
 *
 * Covers the requirements that a type-check cannot: ribbons actually reach the
 * DOM, an empty result renders an explanation rather than a blank SVG, and every
 * ribbon is reachable and readable by keyboard with its FULL path — the labels
 * on the diagram are truncated, so the untruncated path has to live somewhere a
 * screen reader can get to.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NavigationSankey } from "../NavigationSankey";
import type { NavigationFlow } from "@/lib/data/fetchers/admin-analytics.types";

const FLOWS: NavigationFlow[] = [
  { fromPage: "/", toPage: "/map", transitions: 21, visitors: 17 },
  {
    fromPage: "/markets/metro/austin-tx",
    toPage: "/analyzer",
    transitions: 10,
    visitors: 6,
  },
  { fromPage: "/map", toPage: "/", transitions: 9, visitors: 9 },
];

beforeAll(() => {
  // jsdom reports every element as 0x0, and the component correctly refuses to
  // lay out into no space. Give it a viewport.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 720,
    height: 320,
    top: 0,
    left: 0,
    right: 720,
    bottom: 320,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
});

describe("NavigationSankey", () => {
  it("draws one focusable ribbon per flow", () => {
    render(<NavigationSankey flows={FLOWS} />);

    const ribbons = screen.getAllByRole("button");
    expect(ribbons).toHaveLength(FLOWS.length);
    for (const ribbon of ribbons) {
      expect(ribbon.tagName.toLowerCase()).toBe("path");
      expect(ribbon).toHaveAttribute("tabindex", "0");
      expect(ribbon.getAttribute("d")).toMatch(/^M[\d.]+,[\d.]+C/);
    }
  });

  it("names each ribbon with its full path and both measures", () => {
    render(<NavigationSankey flows={FLOWS} />);

    expect(
      screen.getByRole("button", {
        name: /\/markets\/metro\/austin-tx to \/analyzer: 10 transitions, 6 visitors/,
      }),
    ).toBeTruthy();
  });

  it("shows an explanation instead of an empty SVG when there are no flows", () => {
    const { container } = render(<NavigationSankey flows={[]} />);

    expect(container.querySelector("svg")).toBeNull();
    expect(
      screen.getByText(/no navigation flows in this period/i),
    ).toBeTruthy();
  });

  it("reveals the untruncated path in a live region on focus", () => {
    render(<NavigationSankey flows={FLOWS} />);

    const status = screen.getByRole("status");
    expect(status.textContent).toMatch(/hover or tab a ribbon/i);

    // The label on the diagram is middle-truncated; this is where the full path
    // has to be available.
    const ribbon = screen.getByRole("button", {
      name: /\/markets\/metro\/austin-tx to \/analyzer/,
    });
    fireEvent.focusIn(ribbon);

    expect(within(status).getByText("/markets/metro/austin-tx")).toBeTruthy();
    expect(status.textContent).toContain("6 visitors");

    fireEvent.focusOut(ribbon);
    expect(status.textContent).toMatch(/hover or tab a ribbon/i);
  });

  it("drills down on Enter, so the diagram is usable without a mouse", () => {
    const onDrillDown = vi.fn();
    render(<NavigationSankey flows={FLOWS} onDrillDown={onDrillDown} />);

    const ribbon = screen.getByRole("button", { name: /^\/ to \/map:/ });
    fireEvent.keyDown(ribbon, { key: "Enter" });

    expect(onDrillDown).toHaveBeenCalledWith("fromPage", "/");
  });

  it("marks the focused ribbon with a shape cue, not colour alone", () => {
    render(<NavigationSankey flows={FLOWS} />);

    for (const ribbon of screen.getAllByRole("button")) {
      const className = ribbon.getAttribute("class") ?? "";

      // Suppressed the way every other control in this dashboard does it...
      expect(className).toContain("focus:outline-none");
      // ...and replaced, because a <path> takes no ring utility. A stroke is a
      // SHAPE change, so the indicator survives WCAG 1.4.1 and stays followable
      // across 18 ribbons that can each be 2px thin — a fill swap alone did not.
      expect(className).toContain("focus-visible:stroke-2");
      // on-surface is the one token defined to contrast with the surface in BOTH
      // themes. A hex, or a primary stroke on a primary ribbon, would disappear.
      expect(className).toContain("focus-visible:stroke-on-surface");
      expect(className).not.toMatch(/#[0-9a-f]{3,8}/i);
      // The unconditional `outline-none` killed the ring with nothing behind it.
      expect(className).not.toMatch(/(^|\s)outline-none(\s|$)/);
    }
  });

  it("uses semantic colour tokens only, so it inverts in dark mode", () => {
    const { container } = render(<NavigationSankey flows={FLOWS} />);
    const svg = container.querySelector("svg")!;

    const fills = Array.from(svg.querySelectorAll("[fill]")).map((el) =>
      el.getAttribute("fill"),
    );
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) {
      expect(fill).toMatch(/^var\(--color-/);
    }
  });
});
