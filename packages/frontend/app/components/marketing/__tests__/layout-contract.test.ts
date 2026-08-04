import { describe, it, expect } from "vitest";
import { CONTAINER, PROSE, RHYTHM, SURFACE, HEADING } from "../layout-contract";

describe("layout contract is singular", () => {
  it("defines exactly one content max-width", () => {
    expect(CONTAINER.match(/max-w-\S+/g)).toEqual(["max-w-6xl"]);
  });

  it("defines exactly one prose max-width", () => {
    expect(PROSE.match(/max-w-\S+/g)).toEqual(["max-w-3xl"]);
  });

  it("uses one responsive gutter for both containers", () => {
    expect(CONTAINER).toContain("px-6 lg:px-8");
    expect(PROSE).toContain("px-6 lg:px-8");
  });

  it("offers exactly two vertical rhythms", () => {
    expect(Object.keys(RHYTHM)).toEqual(["standard", "tight"]);
  });

  /**
   * Two alternating bands plus one bracket. `hero` is not a third option in
   * the rotation — it is reserved for the homepage's first and last bands, so
   * the page visibly ends where it began. The count is asserted because the
   * whole point of this contract is that surfaces do not proliferate.
   */
  it("offers exactly two alternating surface bands plus the hero bracket", () => {
    expect(Object.keys(SURFACE)).toEqual(["a", "b", "hero"]);
    expect(SURFACE.a).toBe("bg-surface");
    expect(SURFACE.b).toBe("bg-surface-container-low");
    expect(SURFACE.hero).toBe("bg-gradient-to-b from-hero-from to-hero-to");
  });

  it("offers exactly four heading scales", () => {
    expect(Object.keys(HEADING)).toEqual(["hero", "page", "section", "card"]);
  });

  it("contains no arbitrary hex values", () => {
    const all = [
      CONTAINER,
      PROSE,
      ...Object.values(RHYTHM),
      ...Object.values(SURFACE),
      ...Object.values(HEADING),
    ].join(" ");
    expect(all).not.toMatch(/\[#[0-9A-Fa-f]{3,8}\]/);
  });
});
