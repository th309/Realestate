import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// The value-arc tour (step1 = PropertyIQ Score, step2 = AI assessment) now
// lives on the market-detail page, not /map. This is a compile-time presence
// check that the stale step1 spotlight has been removed from /map and is not
// re-introduced. The market-detail mount is covered by
// market/[id]/__tests__/page-tour.test.tsx.
describe("MapPage no longer hosts the tour spotlight", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../page.tsx"), "utf8");

  it("does not import TourSpotlight (the score/why steps moved to /market)", () => {
    expect(src).not.toMatch(/TourSpotlight/);
  });

  it("does not mount a <TourSpotlight stepId=...> on the map page", () => {
    expect(src).not.toMatch(/<TourSpotlight\s+stepId=/);
  });
});
