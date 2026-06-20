import type { Feature, Polygon, MultiPolygon, Position } from "geojson";

// Covers the whole web-mercator-visible world; Mapbox renders later rings as holes.
const WORLD_RING: Position[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

/**
 * Build a dark "spotlight" fill: a world rectangle with the selected geography
 * cut out, so everything OUTSIDE the selection is dimmed and the selection shows
 * clean imagery. Holes = each sub-polygon's outer ring.
 */
export function buildSpotlightMask(
  geometry: Polygon | MultiPolygon,
): Feature<Polygon> {
  const holes: Position[][] = [];
  if (geometry.type === "Polygon") {
    if (geometry.coordinates[0]) holes.push(geometry.coordinates[0]);
  } else {
    for (const poly of geometry.coordinates) {
      if (poly[0]) holes.push(poly[0]);
    }
  }
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [WORLD_RING, ...holes],
    },
  };
}
