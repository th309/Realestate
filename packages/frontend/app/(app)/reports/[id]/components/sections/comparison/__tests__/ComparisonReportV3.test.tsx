import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildMarketBundles } from "../marketBundles";
import { ComparisonVerdictHeader } from "../ComparisonVerdictHeader";

// Real backend nesting: the PRIMARY score is cleaned to scores.propertyiq, but
// each COMPARISON market keeps the RAW getScore result at scores.scores.propertyiq.
// buildMarketBundles must read BOTH or comparison markets show "No Score" (the bug).
const report = {
  primary_geography_id: "metro-1",
  primary_geography_name: "Boise, ID",
  primary_geography_type: "metro",
  user_type: "universal",
  comparison_geographies: [
    { id: "metro-2", type: "metro", name: "Reno, NV" },
    { id: "metro-3", type: "metro", name: "Tampa, FL" },
  ],
  populated_data: {
    current: { home_value: 465000 },
    scores: { propertyiq: { score: 72, grade: "C" } }, // cleaned (primary)
    comparisons: {
      "metro-2": {
        geography: { name: "Reno, NV" },
        current: { home_value: 520000 },
        scores: { scores: { propertyiq: { score: 84, grade: "B" } } }, // raw (comparison)
      },
      "metro-3": {
        geography: { name: "Tampa, FL" },
        current: { home_value: 410000 },
        scores: { scores: { propertyiq: { score: 61 } } },
      },
    },
  },
};

describe("comparison live-score resolution", () => {
  it("buildMarketBundles reads PropertyIQ from BOTH nestings", () => {
    const bundles = buildMarketBundles(report);
    expect(bundles.map((b) => b.score)).toEqual([72, 84, 61]);
    expect(bundles.map((b) => b.name)).toEqual([
      "Boise, ID",
      "Reno, NV",
      "Tampa, FL",
    ]);
    expect(bundles[0].isPrimary).toBe(true);
  });

  it("verdict header shows every market's live score side by side", () => {
    render(<ComparisonVerdictHeader markets={buildMarketBundles(report)} />);
    // One score card per market — names and live scores all present.
    expect(screen.getByText("Boise")).toBeInTheDocument();
    expect(screen.getByText("Reno")).toBeInTheDocument();
    expect(screen.getByText("Tampa")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
  });

  it("flags the top-scoring market as the leader", () => {
    render(<ComparisonVerdictHeader markets={buildMarketBundles(report)} />);
    // Reno (84) is the highest score → the only "Top" badge.
    expect(screen.getAllByText("Top")).toHaveLength(1);
  });

  it("handles a single-market report (no comparisons)", () => {
    const single = {
      ...report,
      comparison_geographies: [],
      populated_data: { ...report.populated_data, comparisons: {} },
    };
    expect(buildMarketBundles(single)).toHaveLength(1);
  });
});
