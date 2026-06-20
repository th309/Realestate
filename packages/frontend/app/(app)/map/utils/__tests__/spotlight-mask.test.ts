import { describe, it, expect } from "vitest";
import type { Polygon, MultiPolygon } from "geojson";
import { buildSpotlightMask } from "../spotlight-mask";

const square: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ],
  ],
};

describe("buildSpotlightMask", () => {
  it("wraps a polygon as a hole inside a world rectangle", () => {
    const mask = buildSpotlightMask(square);
    expect(mask.geometry.type).toBe("Polygon");
    expect(mask.geometry.coordinates[0]).toEqual([
      [-180, -85],
      [180, -85],
      [180, 85],
      [-180, 85],
      [-180, -85],
    ]);
    expect(mask.geometry.coordinates[1]).toEqual(square.coordinates[0]);
  });

  it("cuts every sub-polygon of a MultiPolygon as its own hole", () => {
    const multi: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
        ],
        [
          [
            [5, 5],
            [5, 6],
            [6, 6],
            [6, 5],
            [5, 5],
          ],
        ],
      ],
    };
    const mask = buildSpotlightMask(multi);
    expect(mask.geometry.coordinates.length).toBe(3); // world + 2 holes
    expect(mask.geometry.coordinates[1]).toEqual(multi.coordinates[0][0]);
    expect(mask.geometry.coordinates[2]).toEqual(multi.coordinates[1][0]);
  });
});
