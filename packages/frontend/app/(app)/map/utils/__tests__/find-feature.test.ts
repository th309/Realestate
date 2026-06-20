import { describe, it, expect, vi } from "vitest";
import type { FeatureCollection } from "geojson";

// Isolate the lookup/iteration logic from the real id-extraction internals.
vi.mock("../map-interactions", () => ({
  extractFeatureId: (props: Record<string, unknown> | null) =>
    String(props?.id ?? ""),
}));

import { findFeatureById } from "../find-feature";

const fc: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "A" },
      geometry: { type: "Point", coordinates: [0, 0] },
    },
    {
      type: "Feature",
      properties: { id: "B" },
      geometry: { type: "Point", coordinates: [1, 1] },
    },
  ],
};

describe("findFeatureById", () => {
  it("returns the feature whose extracted id matches", () => {
    expect(findFeatureById(fc, "B")?.properties?.id).toBe("B");
  });
  it("returns null when nothing matches", () => {
    expect(findFeatureById(fc, "Z")).toBeNull();
  });
  it("returns null for a null collection", () => {
    expect(findFeatureById(null, "A")).toBeNull();
  });
});
