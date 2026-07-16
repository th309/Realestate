import { describe, it, expect } from "vitest";
import {
  computeBbox,
  mergeBbox,
  toSvgPath,
  makeProjection,
} from "../geo-projection";

describe("computeBbox", () => {
  it("computes the bounding box of a simple Polygon", () => {
    const geom = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [1, 3],
          [0, 0],
        ] as any,
      ],
    };
    expect(computeBbox(geom)).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 3 });
  });

  it("computes the bounding box across all parts of a MultiPolygon", () => {
    const geom = {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ] as any,
        ],
        [
          [
            [5, 5],
            [6, 5],
            [6, 6],
            [5, 5],
          ] as any,
        ],
      ],
    };
    expect(computeBbox(geom)).toEqual({ minX: 0, minY: 0, maxX: 6, maxY: 6 });
  });

  it("returns an infinite-collapsed box for an empty geometry — callers must guard before use", () => {
    const geom = { type: "Polygon" as const, coordinates: [] };
    const bbox = computeBbox(geom);
    expect(bbox.minX).toBe(Infinity);
    expect(bbox.maxX).toBe(-Infinity);
  });
});

describe("mergeBbox", () => {
  it("unions multiple boxes into their combined extent", () => {
    const a = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
    const b = { minX: -1, minY: 1, maxX: 5, maxY: 3 };
    expect(mergeBbox([a, b])).toEqual({ minX: -1, minY: 0, maxX: 5, maxY: 3 });
  });

  it("returns a zeroed box for an empty list", () => {
    expect(mergeBbox([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
});

describe("makeProjection", () => {
  it("scales to fit the target size along the longer axis and flips Y (latitude grows up, SVG grows down)", () => {
    // Centered on the equator (midLat 0) so cos(midLat) === 1 and the
    // longitude correction is a no-op — isolates the plain scale-to-fit math.
    const bbox = { minX: 0, minY: -2.5, maxX: 10, maxY: 2.5 };
    const { project, width, height } = makeProjection(bbox, 100);
    expect(width).toBeCloseTo(100);
    expect(height).toBeCloseTo(50);
    expect(project(0, 2.5)).toEqual([0, 0]);
    expect(project(10, -2.5)).toEqual([100, 50]);
  });

  it("compresses longitude relative to latitude away from the equator (ground distance = degrees * cos(latitude))", () => {
    // Equal degree spans in lon/lat, centered at 60°N: a naive projection
    // would render a square; the real ground shape is wider than it is tall
    // is WRONG — at 60°N a degree of longitude covers half the ground
    // distance of a degree of latitude (cos(60°) = 0.5), so the correct
    // render is narrower than it is tall.
    const bbox = { minX: 0, minY: 55, maxX: 10, maxY: 65 };
    const { width, height } = makeProjection(bbox, 100);
    expect(height).toBeCloseTo(100); // latitude span is the longer axis after correction
    expect(width).toBeCloseTo(100 * Math.cos((60 * Math.PI) / 180));
    expect(width).toBeLessThan(height);
  });

  it("does not divide by zero for a degenerate (zero-area) bbox", () => {
    const bbox = { minX: 5, minY: 5, maxX: 5, maxY: 5 };
    const { project } = makeProjection(bbox, 100);
    expect(Number.isFinite(project(5, 5)[0])).toBe(true);
  });
});

describe("toSvgPath", () => {
  const identity = (lon: number, lat: number): [number, number] => [lon, lat];

  it("builds one M...Z segment per ring for a Polygon", () => {
    const geom = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [1, 2],
          [0, 0],
        ] as any,
      ],
    };
    expect(toSvgPath(geom, identity)).toBe("M0,0L2,0L1,2L0,0Z");
  });

  it("builds multiple space-separated M...Z segments for a MultiPolygon", () => {
    const geom = {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ] as any,
        ],
        [
          [
            [5, 5],
            [6, 5],
            [6, 6],
            [5, 5],
          ] as any,
        ],
      ],
    };
    expect(toSvgPath(geom, identity)).toBe(
      "M0,0L1,0L1,1L0,0Z M5,5L6,5L6,6L5,5Z",
    );
  });

  it("skips empty rings without crashing, returning an empty string for wholly-empty geometry", () => {
    const geom = { type: "Polygon" as const, coordinates: [[]] };
    expect(toSvgPath(geom, identity)).toBe("");
  });
});
