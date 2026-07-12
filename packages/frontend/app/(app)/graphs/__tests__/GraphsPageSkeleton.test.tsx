/**
 * GraphsPageSkeleton — the /graphs route's Suspense fallback (task 1.2).
 * Replaces the previous centered-spinner `LoadingFallback`. Confirms: no
 * spinner, and the root height matches GraphsPageV2's own root
 * (`lg:h-[calc(100dvh-64px)]` desktop, `max-lg:h-[calc(100dvh-64px-64px-env(safe-area-inset-bottom,0px))]`
 * mobile — the second 64px + inset subtracts BottomNavBar — not a bare
 * `h-screen`) so there's no jump when the real chart area mounts.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GraphsPageSkeleton } from "../GraphsPageSkeleton";

describe("GraphsPageSkeleton", () => {
  it("has no spinner and matches GraphsPageV2's root height exactly", () => {
    const { container } = render(<GraphsPageSkeleton />);
    const root = container.firstChild as HTMLElement;

    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
    expect(root.className).toContain("lg:h-[calc(100dvh-64px)]");
    expect(root.className).toContain(
      "max-lg:h-[calc(100dvh-64px-64px-env(safe-area-inset-bottom,0px))]",
    );
    expect(root.className).not.toContain("h-screen");
  });

  it("renders a header bar, sidebar rail, and chart-area block", () => {
    const { container } = render(<GraphsPageSkeleton />);
    const blocks = container.querySelectorAll('[class*="animate-pulse"]');
    expect(blocks.length).toBeGreaterThanOrEqual(3);
  });
});
