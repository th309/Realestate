/**
 * Polylabel-based centroid calculation for map labels.
 * Uses "pole of inaccessibility" — the point farthest from any polygon edge.
 * Guarantees the label point is always inside the polygon.
 */
import polylabel from "@mapbox/polylabel";

/**
 * Calculate the visual center (pole of inaccessibility) of a GeoJSON geometry.
 * For MultiPolygon, uses the largest polygon by bounding-box area.
 * Returns [lng, lat] or null if geometry is invalid.
 */
export function calculatePolylabel(geometry: any): [number, number] | null {
  if (!geometry || !geometry.coordinates) return null;

  let ring: number[][][] | null = null;

  if (geometry.type === "Polygon") {
    ring = geometry.coordinates;
  } else if (geometry.type === "MultiPolygon") {
    ring = getLargestPolygon(geometry.coordinates);
  }

  if (!ring || ring.length === 0 || ring[0].length === 0) return null;

  try {
    // Precision in coordinate units (degrees). 0.01° ≈ 1.1km — accurate enough
    // for state-level label placement. The previous 1.0° (111km) was too coarse,
    // causing labels like California to land far from the visual center.
    const result = polylabel(ring, 0.01);
    return [result[0], result[1]];
  } catch {
    return bboxCenter(ring[0]);
  }
}

/**
 * Get the bounding box of a geometry as [minLng, minLat, maxLng, maxLat].
 */
export function getGeometryBbox(
  geometry: any,
): [number, number, number, number] | null {
  if (!geometry || !geometry.coordinates) return null;

  let allCoords: number[][] = [];

  if (geometry.type === "Polygon") {
    allCoords = geometry.coordinates[0] || [];
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      if (polygon[0]) allCoords = allCoords.concat(polygon[0]);
    }
  }

  if (allCoords.length === 0) return null;

  let minLng = Infinity,
    maxLng = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;

  for (const [lng, lat] of allCoords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLng, minLat, maxLng, maxLat];
}

/** Find the largest polygon (by bbox area) in a MultiPolygon coordinates array. */
function getLargestPolygon(multiCoords: number[][][][]): number[][][] {
  let largest: number[][][] = multiCoords[0];
  let largestArea = 0;

  for (const polygon of multiCoords) {
    const exterior = polygon[0];
    if (!exterior || exterior.length === 0) continue;

    let minLng = Infinity,
      maxLng = -Infinity;
    let minLat = Infinity,
      maxLat = -Infinity;
    for (const [lng, lat] of exterior) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    const area = (maxLng - minLng) * (maxLat - minLat);
    if (area > largestArea) {
      largestArea = area;
      largest = polygon;
    }
  }

  return largest;
}

/** Bounding box center as fallback. */
function bboxCenter(coords: number[][]): [number, number] | null {
  if (coords.length === 0) return null;

  let minLng = Infinity,
    maxLng = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}
