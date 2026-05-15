import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GradeRing, getLetterGrade } from "../GradeRing";

describe("getLetterGrade", () => {
  it.each([
    [95, "A+"],
    [85, "A"],
    [75, "B"],
    [65, "C"],
    [55, "D"],
    [40, "F"],
    [0, "F"],
  ])("score %i -> %s", (score, expected) => {
    expect(getLetterGrade(score)).toBe(expected);
  });
});

describe("GradeRing", () => {
  it("renders letter + numeric score", () => {
    const { container } = render(<GradeRing score={82} />);
    expect(container.querySelector("[data-grade-letter]")?.textContent).toBe(
      "A",
    );
    expect(container.querySelector("[data-grade-score]")?.textContent).toBe(
      "82/100",
    );
  });

  it("low score renders F + error color", () => {
    const { container } = render(<GradeRing score={30} />);
    expect(container.querySelector("[data-grade-letter]")?.textContent).toBe(
      "F",
    );
    expect(
      container.querySelector("[data-grade-arc]")?.getAttribute("fill"),
    ).toMatch(/--md-error/);
  });
});
