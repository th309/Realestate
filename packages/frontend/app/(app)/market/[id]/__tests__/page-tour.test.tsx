import { describe, it, expect } from "vitest";

// The value-arc tour spotlights (step1 = PropertyIQ Score, step2 = AI
// assessment) mount inside MarketDashboard, co-located with their data-tour
// targets (data-tour="propertyiq-score" in ScoreColumn, data-tour="ai-assessment"
// on the AI section). This is a compile-time presence check on the dashboard.
describe("MarketDashboard mounts both value-arc tour spotlights", () => {
  it("references TourSpotlight with stepId=step1 and stepId=step2", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../MarketDashboard.tsx"),
      "utf8",
    );
    expect(src).toMatch(/TourSpotlight/);
    expect(src).toMatch(/stepId="step1"/);
    expect(src).toMatch(/stepId="step2"/);
  });

  it("retains the data-tour targets the spotlights highlight", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dashboardSrc = fs.readFileSync(
      path.resolve(__dirname, "../MarketDashboard.tsx"),
      "utf8",
    );
    const scoreColumnSrc = fs.readFileSync(
      path.resolve(__dirname, "../components/ScoreColumn.tsx"),
      "utf8",
    );
    // step1 highlights the PropertyIQ Score (lives in ScoreColumn).
    expect(scoreColumnSrc).toMatch(/data-tour="propertyiq-score"/);
    // step2 highlights the AI assessment (lives in MarketDashboard).
    expect(dashboardSrc).toMatch(/data-tour="ai-assessment"/);
  });
});
