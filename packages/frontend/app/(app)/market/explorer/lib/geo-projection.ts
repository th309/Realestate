export type LonLat = [number, number];
export type Ring = LonLat[];
export type PolygonCoords = Ring[];
export type GeoJSONGeometry =
  | { type: "Polygon"; coordinates: PolygonCoords }
  | { type: "MultiPolygon"; coordinates: PolygonCoords[] };

export interface Bbox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Bounding box of a geometry's raw [lon, lat] coordinates. */
export function computeBbox(geometry: GeoJSONGeometry): Bbox {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        if (lon < minX) minX = lon;
        if (lon > maxX) maxX = lon;
        if (lat < minY) minY = lat;
        if (lat > maxY) maxY = lat;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

/** Union of multiple bounding boxes into their combined extent. */
export function mergeBbox(boxes: Bbox[]): Bbox {
  if (!boxes.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return boxes.reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX),
    minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX),
    maxY: Math.max(acc.maxY, b.maxY),
  }));
}

/**
 * Simple equirectangular projection scaled to fit `targetSize` along the
 * bbox's longer axis. Y is flipped: latitude increases northward, SVG y
 * increases downward.
 */
export function makeProjection(
  bbox: Bbox,
  targetSize: number,
): {
  project: (lon: number, lat: number) => [number, number];
  width: number;
  height: number;
} {
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const longerAxis = Math.max(w, h);
  const scale = longerAxis === 0 ? 1 : targetSize / longerAxis;
  const project = (lon: number, lat: number): [number, number] => [
    (lon - bbox.minX) * scale,
    (bbox.maxY - lat) * scale,
  ];
  return { project, width: w * scale, height: h * scale };
}

/**
 * Projects a geometry into an SVG path `d` string. Polygon -> one M...Z per
 * ring (outer + holes); MultiPolygon -> space-separated M...Z per ring across
 * every polygon part.
 */
export function toSvgPath(
  geometry: GeoJSONGeometry,
  project: (lon: number, lat: number) => [number, number],
): string {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const segments: string[] = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      if (!ring.length) continue;
      const points = ring.map(([lon, lat]) => project(lon, lat));
      segments.push("M" + points.map((p) => `${p[0]},${p[1]}`).join("L") + "Z");
    }
  }
  return segments.join(" ");
}
