import type { Map as MapboxMap } from "mapbox-gl";
import { CINEMATIC } from "../config/constants";

export const DEM_SOURCE = "cinematic-dem";
export const BUILDINGS_LAYER = "cinematic-3d-buildings";

/** Real 3D: extruded buildings (from the light-v11 composite "building" layer)
 *  + draped terrain relief. Only meaningful at high zoom (ZIP). */
export function enable3D(map: MapboxMap): void {
  if (!map.getSource(DEM_SOURCE)) {
    map.addSource(DEM_SOURCE, {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({
    source: DEM_SOURCE,
    exaggeration: CINEMATIC.TERRAIN_EXAGGERATION,
  });

  if (!map.getLayer(BUILDINGS_LAYER)) {
    map.addLayer({
      id: BUILDINGS_LAYER,
      type: "fill-extrusion",
      source: "composite",
      "source-layer": "building",
      minzoom: CINEMATIC.BUILDINGS_MIN_ZOOM,
      filter: ["==", ["get", "extrude"], "true"],
      paint: {
        "fill-extrusion-color": "#c9ccd6",
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": ["get", "min_height"],
        "fill-extrusion-opacity": 0.85,
      },
    });
  }
}

export function disable3D(map: MapboxMap): void {
  map.setTerrain(null);
  if (map.getLayer(BUILDINGS_LAYER)) {
    map.removeLayer(BUILDINGS_LAYER);
  }
}
