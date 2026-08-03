import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BeatHero } from "../BeatHero";

describe("BeatHero", () => {
  it("renders exactly one h1", () => {
    render(<BeatHero />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders the h1 at the hero scale from the contract", () => {
    render(<BeatHero />);
    expect(screen.getByRole("heading", { level: 1 }).className).toContain(
      "text-4xl md:text-5xl lg:text-6xl",
    );
  });

  it("renders score numerals in monospace", () => {
    const { container } = render(<BeatHero />);
    expect(
      container.querySelectorAll(".font-mono.tabular-nums").length,
    ).toBeGreaterThan(0);
  });

  it("uses the hero gradient tokens, not hardcoded hex", () => {
    const { container } = render(<BeatHero />);
    expect(container.innerHTML).toContain("from-hero-from");
    expect(container.innerHTML).not.toMatch(/\[#[0-9A-Fa-f]{6}\]/);
  });

  it("describes the score as 1-99, never 0-100", () => {
    const { container } = render(<BeatHero />);
    expect(container.textContent).not.toContain("0–100");
    expect(container.textContent).not.toContain("0-100");
  });

  /**
   * The plan called for a product screenshot here. Every asset in
   * public/images/home/ predates the single-PropertyIQ-Score migration —
   * market-scores-detail-v2.png alone shows a retired "InvestorEdge Score" and
   * a "VERY POOR" quality label, which CLAUDE.md section 9 forbids outright. So
   * the hero ships without one rather than putting retired branding above the
   * fold; the live cooler-vs-riser cards carry the proof instead.
   */
  it("ships no stale product screenshot", () => {
    const { container } = render(<BeatHero />);
    expect(container.querySelector("img")).toBeNull();
  });
});

/**
 * The hero band is now a PALE wash (`--md-hero-from` / `--md-hero-to`), not the
 * dark top of a page-wide indigo gradient. Any surviving light-on-dark colour
 * would be invisible against it.
 */
describe("BeatHero is toned for a light band", () => {
  /**
   * `text-primary-light` is a light-on-dark token with no legitimate use here.
   * (`text-on-primary` is NOT checked: it is correct on PrimaryCta's indigo
   * button, where it is white-on-primary rather than white-on-wash.)
   */
  it("does not paint text-primary-light on the pale wash", () => {
    const { container } = render(<BeatHero />);
    expect(container.innerHTML).not.toContain("text-primary-light");
  });

  it("paints the headline in an on-surface token", () => {
    render(<BeatHero />);
    expect(screen.getByRole("heading", { level: 1 }).className).toContain(
      "text-on-surface",
    );
  });
});
