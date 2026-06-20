import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { Feature, FeatureCollection } from "geojson";
import { CINEMATIC } from "../config/constants";

export const SAT_SOURCE = "cinematic-satellite-src";
export const SAT_LAYER = "cinematic-satellite";
export const SEL_SOURCE = "cinematic-selected-src";
export const MASK_SOURCE = "cinematic-mask-src";
export const MASK_LAYER = "cinematic-mask";
export const OUTLINE_GLOW_LAYER = "cinematic-outline-glow";
export const OUTLINE_LAYER = "cinematic-outline";

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

/** Idempotently add satellite (beneath choropleth), mask + outline (on top).
 *  Only called from the flag-gated hook, after a region click (so geo-fills exists). */
export function ensureCinematicLayers(map: MapboxMap): void {
  if (!map.getSource(SAT_SOURCE)) {
    map.addSource(SAT_SOURCE, {
      type: "raster",
      url: "mapbox://mapbox.satellite",
      tileSize: 256,
    });
  }
  if (!map.getLayer(SAT_LAYER)) {
    const beforeId = map.getLayer("geo-fills") ? "geo-fills" : undefined;
    map.addLayer(
      {
        id: SAT_LAYER,
        type: "raster",
        source: SAT_SOURCE,
        paint: {
          "raster-opacity": 0,
          "raster-opacity-transition": {
            duration: CINEMATIC.SATELLITE_FADE_MS,
          },
        },
      },
      beforeId,
    );
  }
  if (!map.getSource(MASK_SOURCE)) {
    map.addSource(MASK_SOURCE, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getSource(SEL_SOURCE)) {
    map.addSource(SEL_SOURCE, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getLayer(MASK_LAYER)) {
    map.addLayer({
      id: MASK_LAYER,
      type: "fill",
      source: MASK_SOURCE,
      paint: {
        "fill-color": CINEMATIC.MASK_COLOR,
        "fill-opacity": 0,
        "fill-opacity-transition": { duration: CINEMATIC.SATELLITE_FADE_MS },
      },
    });
  }
  if (!map.getLayer(OUTLINE_GLOW_LAYER)) {
    map.addLayer({
      id: OUTLINE_GLOW_LAYER,
      type: "line",
      source: SEL_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": CINEMATIC.OUTLINE_GLOW_COLOR,
        "line-width": CINEMATIC.OUTLINE_WIDTH * 3,
        "line-opacity": 0.5,
        "line-blur": 3,
      },
    });
  }
  if (!map.getLayer(OUTLINE_LAYER)) {
    map.addLayer({
      id: OUTLINE_LAYER,
      type: "line",
      source: SEL_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": CINEMATIC.OUTLINE_COLOR,
        "line-width": CINEMATIC.OUTLINE_WIDTH,
        "line-opacity": 1,
      },
    });
  }
}

export function fadeSatellite(map: MapboxMap, visible: boolean): void {
  if (map.getLayer(SAT_LAYER)) {
    map.setPaintProperty(SAT_LAYER, "raster-opacity", visible ? 1 : 0);
  }
  if (map.getLayer(MASK_LAYER)) {
    map.setPaintProperty(
      MASK_LAYER,
      "fill-opacity",
      visible ? CINEMATIC.MASK_OPACITY : 0,
    );
  }
}

export function setSelectedFeature(
  map: MapboxMap,
  feature: Feature,
  maskFeature: Feature,
): void {
  (map.getSource(SEL_SOURCE) as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: [feature],
  });
  (map.getSource(MASK_SOURCE) as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: [maskFeature],
  });
}

export function clearSelectedFeature(map: MapboxMap): void {
  (map.getSource(SEL_SOURCE) as GeoJSONSource | undefined)?.setData(EMPTY_FC);
  (map.getSource(MASK_SOURCE) as GeoJSONSource | undefined)?.setData(EMPTY_FC);
}

/** Drop the metric tint inside the selected moment; restore on deselect. */
export function setChoroplethDimmed(map: MapboxMap, dimmed: boolean): void {
  if (map.getLayer("geo-fills")) {
    map.setPaintProperty(
      "geo-fills",
      "fill-opacity",
      dimmed ? 0 : CINEMATIC.CHOROPLETH_DEFAULT_OPACITY,
    );
  }
}
