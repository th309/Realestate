/**
 * Skeleton primitive — task 1.2 (skeleton loading states).
 *
 * Covers the reduced-motion class logic (Tailwind's motion-safe: variant
 * means an element only pulses when the user has NOT requested reduced
 * motion — under `prefers-reduced-motion: reduce` the browser simply never
 * matches the variant, leaving a static tonal block, no JS media query
 * needed) and the variant-aware SkeletonStatCard dimension parity with
 * StatCard's three variants.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, SkeletonStatCard } from "../Skeleton";

describe("Skeleton", () => {
  it("applies the motion-safe pulse variant by default (static under reduced motion)", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("motion-safe:animate-pulse");
    // Never a plain always-on animation class — reduced-motion users must
    // never see it regardless of Tailwind's media-query gate.
    expect(el.className).not.toMatch(/(?<!motion-safe:)animate-pulse/);
  });

  it("renders no animation class when animation='none'", () => {
    const { container } = render(<Skeleton animation="none" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toContain("animate-pulse");
  });

  it("uses semantic tone tokens, never a hardcoded gray", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-surface-container-highest");
    expect(el.className).not.toMatch(/gray-\d/);
    expect(el.style.backgroundColor).toBe("");
  });

  it.each([
    ["text", "rounded"],
    ["circular", "rounded-full"],
    ["rectangular", "rounded-none"],
    ["rounded", "rounded-xl"],
  ] as const)("variant=%s maps to radius class %s", (variant, radiusClass) => {
    const { container } = render(<Skeleton variant={variant} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain(radiusClass);
  });

  it("converts numeric width/height to pixel inline styles", () => {
    const { container } = render(<Skeleton width={80} height={28} />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ width: "80px", height: "28px" });
  });
});

describe("SkeletonStatCard — dimension parity with StatCard variants", () => {
  it("default variant matches StatCard default container (rounded-xl p-4)", () => {
    const { container } = render(<SkeletonStatCard />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("rounded-xl");
    expect(el.className).toContain("p-4");
    expect(el.className).toContain("bg-surface-container-low");
  });

  it("large variant matches StatCard large container (rounded-2xl p-6)", () => {
    const { container } = render(<SkeletonStatCard variant="large" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("rounded-2xl");
    expect(el.className).toContain("p-6");
  });

  it("compact variant has no card wrapper (bare flex row, like StatCard compact)", () => {
    const { container } = render(<SkeletonStatCard variant="compact" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toContain("bg-surface-container-low");
    expect(el.className).toContain("flex");
    expect(el.className).toContain("justify-between");
  });

  it("hasIcon=false omits the icon placeholder (one fewer skeleton block)", () => {
    const { container: withIcon } = render(<SkeletonStatCard hasIcon />);
    const { container: withoutIcon } = render(
      <SkeletonStatCard hasIcon={false} />,
    );
    const countBlocks = (c: HTMLElement) =>
      c.querySelectorAll('[class*="bg-surface-container-highest"]').length;
    expect(countBlocks(withoutIcon)).toBe(countBlocks(withIcon) - 1);
  });
});
