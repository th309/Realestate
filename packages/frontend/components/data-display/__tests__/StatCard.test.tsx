/**
 * StatCard loading state — task 1.2 (skeleton loading states).
 *
 * StatCard already delegated to SkeletonStatCard before this task, but the
 * skeleton didn't vary by `variant`, so a `loading` card in the "large" or
 * "compact" variant rendered the DEFAULT card's shape (rounded-xl p-4)
 * instead of its own (rounded-2xl p-6, or a bare compact row) — a dimension
 * mismatch that would jump layout the moment data arrives. These tests lock
 * in the per-variant fix.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "../StatCard";

describe("StatCard loading state", () => {
  it("default variant: skeleton matches the default card shape, no spinner", () => {
    const { container } = render(
      <StatCard label="Median Home Value" value="—" loading />,
    );
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("p-4");
    expect(screen.queryByText("Median Home Value")).not.toBeInTheDocument();
  });

  it("large variant: skeleton matches the large card shape (rounded-2xl p-6)", () => {
    const { container } = render(
      <StatCard label="Median Home Value" value="—" loading variant="large" />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("rounded-2xl");
    expect(card.className).toContain("p-6");
  });

  it("compact variant: skeleton matches the bare row shape (no card background)", () => {
    const { container } = render(
      <StatCard
        label="Median Home Value"
        value="—"
        loading
        variant="compact"
      />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("bg-surface-container-low");
    expect(card.className).toContain("justify-between");
  });

  it("omits the icon placeholder when no icon prop is passed", () => {
    const withIcon = render(
      <StatCard
        label="Median Home Value"
        value="—"
        loading
        icon={<span>icon</span>}
      />,
    );
    const withoutIcon = render(
      <StatCard label="Median Home Value" value="—" loading />,
    );
    const countBlocks = (c: HTMLElement) =>
      c.querySelectorAll('[class*="bg-surface-container-highest"]').length;
    expect(countBlocks(withoutIcon.container)).toBe(
      countBlocks(withIcon.container) - 1,
    );
  });

  it("renders the real label/value once loaded", () => {
    render(<StatCard label="Median Home Value" value="$450,000" />);
    expect(screen.getByText("Median Home Value")).toBeInTheDocument();
    expect(screen.getByText("$450,000")).toBeInTheDocument();
  });
});
