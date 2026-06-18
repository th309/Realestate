import {
  getScoreChangeColor,
  formatScoreChange,
  WINDOW_TO_COLUMN,
  DEFAULT_WINDOW,
} from "./score-change";

describe("score-change helpers", () => {
  it("colors gains green, losses red, zero/null neutral (flat threshold)", () => {
    expect(getScoreChangeColor(5)).toContain("tertiary");
    expect(getScoreChangeColor(40)).toBe(getScoreChangeColor(5)); // flat — no grading
    expect(getScoreChangeColor(-3)).toContain("error");
    expect(getScoreChangeColor(0)).toContain("on-surface-variant");
    expect(getScoreChangeColor(null)).toContain("on-surface-variant");
  });

  it("formats signed integers and em-dash for null", () => {
    expect(formatScoreChange(14)).toBe("+14");
    expect(formatScoreChange(-7)).toBe("−7"); // U+2212 minus
    expect(formatScoreChange(0)).toBe("0");
    expect(formatScoreChange(null)).toBe("—");
  });

  it("maps windows to snapshot columns and defaults to 90d", () => {
    expect(WINDOW_TO_COLUMN["1y"]).toBe("score_chg_1y");
    expect(DEFAULT_WINDOW).toBe("3m");
  });
});
