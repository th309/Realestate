import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RentCastBadge } from "../RentCastBadge";

describe("RentCastBadge", () => {
  it("fresh: renders green dot + tertiary tone", () => {
    const { container } = render(<RentCastBadge state="fresh" />);
    const el = container.querySelector("[data-rentcast-badge]");
    expect(el?.textContent).toMatch(/🟢/);
    expect(el?.className).toMatch(/tertiary/);
    expect(el?.getAttribute("data-state")).toBe("fresh");
  });

  it("stale: renders yellow dot + warning tone + 'stale' label", () => {
    const { container } = render(<RentCastBadge state="stale" />);
    const el = container.querySelector("[data-rentcast-badge]");
    expect(el?.textContent).toMatch(/🟡/);
    expect(el?.textContent).toMatch(/stale/);
    expect(el?.className).toMatch(/warning/);
  });

  it("missing: renders gray dot", () => {
    const { container } = render(<RentCastBadge state="missing" />);
    const el = container.querySelector("[data-rentcast-badge]");
    expect(el?.textContent).toMatch(/⚪/);
  });
});
