import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RentCastBadge } from "../RentCastBadge";

/**
 * The badge is a five-star confidence rating, so the assertions are on how
 * many stars are filled and in what tone — not on an emoji glyph, which is
 * what this used to encode the three states with.
 */
function filledStars(el: Element | null): number {
  return el?.querySelectorAll('svg[fill="currentColor"]').length ?? 0;
}

describe("RentCastBadge", () => {
  it("fresh: five filled stars in the green tone", () => {
    const { container } = render(<RentCastBadge state="fresh" />);
    const el = container.querySelector("[data-rentcast-badge]");
    expect(el?.getAttribute("data-state")).toBe("fresh");
    expect(filledStars(el)).toBe(5);
    expect(el?.querySelector(".text-piq-green")).toBeTruthy();
    expect(el?.textContent).toMatch(/RentCast/);
  });

  it("stale: partial rating in the amber tone, labelled stale", () => {
    const { container } = render(<RentCastBadge state="stale" />);
    const el = container.querySelector("[data-rentcast-badge]");
    expect(filledStars(el)).toBe(3);
    expect(el?.querySelector(".text-piq-amber")).toBeTruthy();
    expect(el?.textContent).toMatch(/stale/);
  });

  it("missing: lowest rating in the red tone, labelled an estimate", () => {
    const { container } = render(<RentCastBadge state="missing" />);
    const el = container.querySelector("[data-rentcast-badge]");
    expect(filledStars(el)).toBe(1);
    expect(el?.querySelector(".text-piq-red")).toBeTruthy();
    expect(el?.textContent).toMatch(/Estimate/);
  });

  it("always renders five stars regardless of state", () => {
    for (const state of ["fresh", "stale", "missing"] as const) {
      const { container } = render(<RentCastBadge state={state} />);
      const el = container.querySelector("[data-rentcast-badge]");
      expect(el?.querySelectorAll("svg").length).toBe(5);
    }
  });
});
