import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// MapPage has heavy dependencies (mapbox-gl, providers, hooks) that make a
// render-based test brittle. The TourSpotlight component itself is covered by
// TourSpotlight.test.tsx (Phase 03 Task 3). Here we verify the integration
// point: that /map/page.tsx imports TourSpotlight and renders it with
// stepId="step1". This is a compile-time presence check.
describe("MapPage integrates TourSpotlight (Phase 03 T6)", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../page.tsx"), "utf8");

  it("imports TourSpotlight from the tour module", () => {
    expect(src).toMatch(
      /import\s*\{\s*TourSpotlight\s*\}\s*from\s*["']@\/app\/tour\/components\/TourSpotlight["']/,
    );
  });

  it('renders <TourSpotlight stepId="step1" /> in the page tree', () => {
    expect(src).toMatch(/<TourSpotlight\s+stepId=["']step1["']\s*\/>/);
  });

  it('retains the data-tour="search-bar" hook the spotlight targets', () => {
    // The search-bar hook lives in MapToolbar (rendered by the page), not page.tsx.
    const toolbarSrc = fs.readFileSync(
      path.resolve(__dirname, "../MapToolbar.tsx"),
      "utf8",
    );
    expect(toolbarSrc).toMatch(/data-tour=["']search-bar["']/);
  });
});
