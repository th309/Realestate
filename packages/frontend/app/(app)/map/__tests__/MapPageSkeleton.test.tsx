/**
 * MapPageSkeleton — the /map route's Suspense fallback (task 1.2). Replaces
 * the previous `<div className="h-screen w-full bg-surface" />` spinner-free
 * but shapeless placeholder. Confirms: no spinner, root container mirrors
 * MapPageInner's own root (`absolute inset-0 flex flex-col`, not h-screen)
 * so the swap to the real map never shifts layout, and a canvas block +
 * legend chip are present per the brief.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MapPageSkeleton } from "../MapPageSkeleton";

describe("MapPageSkeleton", () => {
  it("has no spinner and uses absolute inset-0 (matches MapPageInner's root, not h-screen)", () => {
    const { container } = render(<MapPageSkeleton />);
    const root = container.firstChild as HTMLElement;

    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
    expect(root.className).toContain("absolute");
    expect(root.className).toContain("inset-0");
    expect(root.className).not.toContain("h-screen");
  });

  it("renders a toolbar strip, canvas block, and legend chip", () => {
    const { container } = render(<MapPageSkeleton />);
    // At least one motion-safe pulse block for each named zone.
    const blocks = container.querySelectorAll('[class*="animate-pulse"]');
    expect(blocks.length).toBeGreaterThanOrEqual(3);
  });

  it("marks itself as a busy status region for assistive tech", () => {
    const { getByRole } = render(<MapPageSkeleton />);
    const status = getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
  });
});
