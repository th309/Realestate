import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ScoreRing } from "@/app/components/scoring/ScoreRing";

describe("ScoreRing", () => {
  it("renders the score number", () => {
    const { getByText } = render(<ScoreRing score={73} />);
    expect(getByText("73")).toBeInTheDocument();
  });

  it("clamps score to 0-100 in the gradient angle", () => {
    const { container } = render(<ScoreRing score={150} />);
    const ring = container.firstChild as HTMLElement;
    // angle should be 360deg max
    expect(ring.getAttribute("style")).toMatch(/360deg/);
  });

  it("clamps negative scores to 0deg", () => {
    const { container } = render(<ScoreRing score={-10} />);
    const ring = container.firstChild as HTMLElement;
    expect(ring.getAttribute("style")).toMatch(/0deg \d+deg/); // first stop at 0deg
  });

  it("respects size prop (lg has 130px width)", () => {
    const { container } = render(<ScoreRing score={50} size="lg" />);
    const ring = container.firstChild as HTMLElement;
    expect(ring.style.width).toBe("130px");
  });

  it("has aria-label describing the score", () => {
    const { container } = render(<ScoreRing score={42} />);
    const ring = container.firstChild as HTMLElement;
    expect(ring.getAttribute("aria-label")).toMatch(/42 of 100/);
  });

  it("uses semantic CSS variables for the empty track", () => {
    // The unfilled portion of the ring uses a CSS variable. The filled portion
    // uses getScoreColor() from the standardized scoring utility (CLAUDE.md §9),
    // which returns an hsl() string — that is an accepted exception to the
    // "no inline color" rule because the value comes from a central utility,
    // not from this component.
    const { container } = render(<ScoreRing score={50} />);
    const html = container.innerHTML;
    expect(html).toMatch(/var\(--md-/);
    // Filled portion should be hsl(...) from getScoreColor, not a hardcoded hex.
    expect(html).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(html).toMatch(/hsl\(/);
  });

  it("uses different gradient colors for different score buckets", () => {
    const { container: lowContainer } = render(<ScoreRing score={10} />);
    const { container: highContainer } = render(<ScoreRing score={90} />);
    const lowStyle = (lowContainer.firstChild as HTMLElement).style.background;
    const highStyle = (highContainer.firstChild as HTMLElement).style
      .background;
    // Different scores should produce different gradients (different fill colors).
    expect(lowStyle).not.toEqual(highStyle);
    // Both should be conic-gradients.
    expect(lowStyle).toMatch(/conic-gradient/);
    expect(highStyle).toMatch(/conic-gradient/);
  });
});
