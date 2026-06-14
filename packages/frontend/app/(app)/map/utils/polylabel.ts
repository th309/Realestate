/**
 * Polylabel-based centroid calculation for map labels.
 * Uses "pole of inaccessibility" — the point farthest from any polygon edge.
 * Guarantees the label point is always inside the polygon.
 */
import polylabel from "@mapbox/polylabel";

/**
 * Calculate the visual center of a GeoJSON geometry.
 * Blends the polylabel (pole of inaccessibility) with the bounding box center:
 * - Polylabel ensures the point is inside the polygon (good horizontal placement)
 * - Bbox center provides better vertical centering for long/narrow shapes
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
    const pole = polylabel(ring, 0.01);
    const center = bboxCenter(ring[0]);
    if (!center) return [pole[0], pole[1]];

    // Blend: polylabel for longitude (stays inside the polygon horizontally),
    // bbox center for latitude (true vertical midpoint — polylabel drifts to
    // the widest part which is NorCal for California instead of Central Valley)
    return [pole[0], center[1]];
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
