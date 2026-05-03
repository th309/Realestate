import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ScoreRing } from "../ScoreRing";

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

  it("uses semantic CSS variables — no hardcoded hex", () => {
    const { container } = render(<ScoreRing score={50} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(html).toMatch(/var\(--md-/);
  });
});
