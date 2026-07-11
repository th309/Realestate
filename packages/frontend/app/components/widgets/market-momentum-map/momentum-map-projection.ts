/**
 * MOMENTUM MAP PROJECTION
 *
 * geoAlbersUsa helpers for the Market Momentum Map. The projection covers the
 * contiguous US with AK + HI insets; Puerto Rico metros do not project and
 * are excluded (covered by the widget footnote). Sizing follows the us-atlas
 * convention: scale 1300 over a 975×610 viewport.
 */

import { geoAlbersUsa, geoPath, scaleSqrt, type GeoProjection } from "d3";
import type { FeatureCollection } from "geojson";
import type { ScoreHeatmapMetro } from "@/lib/data";

export const MAP_VIEWBOX_WIDTH = 975;
export const MAP_VIEWBOX_HEIGHT = 610;

export interface ProjectedMetro extends ScoreHeatmapMetro {
  x: number;
  y: number;
  r: number;
  /** Row index into payload.scores — survives PR-drop and size sorting. */
  matrixIndex: number;
}

export function createUsProjection(): GeoProjection {
  return geoAlbersUsa()
    .scale(1300)
    .translate([MAP_VIEWBOX_WIDTH / 2, MAP_VIEWBOX_HEIGHT / 2]);
}

export function projectMetros(
  metros: ScoreHeatmapMetro[],
  options: { minRadius: number; maxRadius: number },
): ProjectedMetro[] {
  const projection = createUsProjection();
  const maxPop = Math.max(1, ...metros.map((m) => m.pop ?? 0));
  const radius = scaleSqrt()
    .domain([0, maxPop])
    .range([options.minRadius, options.maxRadius]);

  const projected: ProjectedMetro[] = [];
  metros.forEach((metro, matrixIndex) => {
    const point = projection([metro.lon, metro.lat]);
    if (!point) return; // outside the projection (e.g. Puerto Rico)
    projected.push({
      ...metro,
      matrixIndex,
      x: point[0],
      y: point[1],
      r: radius(metro.pop ?? 0),
    });
  });

  // Big metros first so small dots render on top and stay hoverable.
  return projected.sort((a, b) => b.r - a.r);
}

/** Pre-rendered SVG path strings for the state-outline basemap. */
export function buildStatePaths(statesGeojson: FeatureCollection): string[] {
  const path = geoPath(createUsProjection());
  return statesGeojson.features
    .map((feature) => path(feature) ?? "")
    .filter(Boolean);
}
