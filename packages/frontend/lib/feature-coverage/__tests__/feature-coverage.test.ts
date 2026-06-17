import { describe, it, expect } from "vitest";
import { deriveCoverage, normalizePersona } from "../feature-coverage";

describe("deriveCoverage", () => {
  it("marks used features and recommends the highest-value unused one (investor)", () => {
    const coverage = deriveCoverage({
      persona: "investor",
      usedFeatures: ["screener_filter"], // → screener used
      mcpConnected: false,
      checklist: ["view_score"],
      usageStats: { markets_viewed: 1, scores_checked: 1, reports_generated: 0 },
    });

    expect(coverage.byFeature.screener.used).toBe(true);
    expect(coverage.byFeature.score.used).toBe(true);
    expect(coverage.byFeature.mcp.used).toBe(false);
    // Investor priority leads with mcp (never used).
    expect(coverage.recommendedNext).toBe("mcp");
  });

  it("returns a null recommendation when every feature is covered", () => {
    const coverage = deriveCoverage({
      persona: "investor",
      usedFeatures: [
        "analyzer_grade",
        "screener_filter",
        "graphs_view",
        "watchlist_add",
        "compare",
        "report",
      ],
      mcpConnected: true,
      checklist: ["view_score", "read_report", "compare_markets"],
      usageStats: { markets_viewed: 5, scores_checked: 5, reports_generated: 2 },
    });

    expect(coverage.recommendedNext).toBeNull();
  });
});

describe("normalizePersona", () => {
  it("passes through the three canonical personas", () => {
    expect(normalizePersona("investor")).toBe("investor");
    expect(normalizePersona("agent")).toBe("agent");
    expect(normalizePersona("homebuyer")).toBe("homebuyer");
  });

  it("maps unknown / missing values to null", () => {
    expect(normalizePersona("first_time_buyer")).toBeNull();
    expect(normalizePersona(null)).toBeNull();
    expect(normalizePersona(undefined)).toBeNull();
  });
});
