import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");

const INNER = read("MapPageInner.tsx");
const SCORE_CARD = read("components/sidebar-components/SidebarScoreCard.tsx");

/**
 * The Mapbox layer is out of bounds for this task. `MapPageInner` imports
 * mapbox-gl and the map hooks, so it trips the boundary grep — but it
 * configures no sources, layers, paint properties, or label placement; those
 * live in `hooks/useMapLayers.ts` and `utils/*`. Editing its chrome is in
 * scope; dropping its map wiring is not, so assert the wiring is intact.
 */
describe("map chrome edits leave the Mapbox layer wired", () => {
  const MAP_HOOKS = [
    "useMapInstance",
    "useMapData",
    "useMapLayers",
    "useMapSelection",
    "useMapCamera",
    "useMapViewParams",
    "useMapDeepLinkNav",
    "useMapSearch",
  ];

  for (const hook of MAP_HOOKS) {
    it(`still wires ${hook}`, () => {
      expect(INNER).toContain(hook);
    });
  }

  it("still mounts the map canvas and its container ref", () => {
    expect(INNER).toContain("MapCanvas");
    expect(INNER).toContain("mapContainer");
  });

  it("uses no arbitrary hex", () => {
    expect(INNER).not.toMatch(/\[#[0-9A-Fa-f]{3,8}\]/);
  });
});

/**
 * There is no state-level PropertyIQ Score. The geography enum is metro,
 * county and ZIP; 50 is the calibration point AGAINST a state average, not a
 * score a state holds (CLAUDE.md section 9). The card used to read "Select a
 * region to see scores" at every level, so at State a user could click every
 * state and never get a score.
 */
describe("map score card does not imply a state-level score", () => {
  it("names the levels the score actually runs at", () => {
    expect(SCORE_CARD).toMatch(
      /metro, county, and ZIP|not scored at state level/i,
    );
  });

  it("offers the three scored levels as a way out", () => {
    expect(SCORE_CARD).toContain("SCORED_LEVELS");
    expect(SCORE_CARD).toMatch(/\["metro", "county", "zip"\]/);
  });

  it("keeps the generic prompt for levels that DO have scores", () => {
    // Metro/county/ZIP still say "select a region" — nothing to change there.
    expect(SCORE_CARD).toContain("Select a region to see scores");
  });

  it("never states the score's range as 0-100", () => {
    expect(SCORE_CARD).not.toMatch(/0\s*[-–]\s*100|out of 100/);
  });
});
