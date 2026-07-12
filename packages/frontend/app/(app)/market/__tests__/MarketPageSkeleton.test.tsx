/**
 * MarketPageSkeleton — the /market route's Suspense fallback (task 1.2).
 * Replaces the previous centered-spinner `LoadingFallback`. Confirms: no
 * spinner, root uses `min-h-dvh` (not `h-screen`/`min-h-screen`) per the
 * brief, and header row + card grid sections are present.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarketPageSkeleton } from "../MarketPageSkeleton";

describe("MarketPageSkeleton", () => {
  it("has no spinner and uses min-h-dvh (not h-screen)", () => {
    const { container } = render(<MarketPageSkeleton />);
    const root = container.firstChild as HTMLElement;

    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
    expect(root.className).toContain("min-h-dvh");
    expect(root.className).not.toMatch(/(?<!min-)h-screen/);
  });

  it("renders a header row and a card grid", () => {
    const { container } = render(<MarketPageSkeleton />);
    expect(container.querySelector(".grid")).toBeInTheDocument();
    const blocks = container.querySelectorAll('[class*="animate-pulse"]');
    expect(blocks.length).toBeGreaterThanOrEqual(3);
  });
});
