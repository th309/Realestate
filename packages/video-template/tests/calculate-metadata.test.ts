import { describe, it, expect } from "@jest/globals";

const INTRO = 90,
  ROW = 150,
  OUTRO = 135;
function calc(n: number) {
  return INTRO + n * ROW + OUTRO;
}

describe("ranking calculateMetadata", () => {
  it("N=5 → 975 frames (32.5s)", () => {
    expect(calc(5)).toBe(975);
  });
  it("N=10 → 1725 frames (57.5s)", () => {
    expect(calc(10)).toBe(1725);
  });
});
