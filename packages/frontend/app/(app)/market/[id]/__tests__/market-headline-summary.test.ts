import { describe, it, expect } from "vitest";
import { buildHeadlineSummary } from "../market-headline-summary";

describe("buildHeadlineSummary", () => {
  it("frames the market with a momentum word and the score", () => {
    const result = buildHeadlineSummary("Austin, TX", 62, {
      home_value: {
        formattedValue: "$455K",
        percentChange: 3.1,
        value: 455000,
      },
    });
    // getScoreLabel(62) === 'FIRMING'
    expect(result.summary.toLowerCase()).toContain("firming");
    expect(result.summary).toContain("62");
    expect(result.summary).toContain("$455K");
    expect(result.summary).toContain("up 3.1% year over year");
    expect(result.headline.toLowerCase()).toContain("firming momentum");
  });

  it("never uses quality words", () => {
    const result = buildHeadlineSummary("Toledo, OH", 30, {
      home_value: {
        formattedValue: "$120K",
        percentChange: -1.2,
        value: 120000,
      },
    });
    expect(result.summary.toLowerCase()).not.toMatch(/good|bad|excellent|poor/);
    expect(result.summary).toContain("down 1.2% year over year");
  });

  it("returns a neutral overview when the score is unavailable", () => {
    const result = buildHeadlineSummary("Nowhere, USA", null, {});
    expect(result.headline).toContain("Nowhere, USA");
    expect(result.summary).toContain("Nowhere, USA");
  });
});
