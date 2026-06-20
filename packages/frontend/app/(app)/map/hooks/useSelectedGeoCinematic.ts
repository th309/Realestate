import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import type { GeoLevel } from "@/lib/data";
import type { SelectedGeography } from "../types";
import {
  isCinematicZoomEnabled,
  getCinematicConfig,
} from "../utils/cinematic-config";
import { buildSpotlightMask } from "../utils/spotlight-mask";
import { findFeatureById } from "../utils/find-feature";
import { getGeometryBbox } from "../utils/polylabel";
import { CINEMATIC } from "../config/constants";
import {
  ensureCinematicLayers,
  fadeSatellite,
  setSelectedFeature,
  clearSelectedFeature,
  setChoroplethDimmed,
} from "../utils/cinematic-layers";
import { enable3D, disable3D } from "../utils/cinematic-3d";

interface UseSelectedGeoCinematicOptions {
  mapRef: MutableRefObject<MapboxMap | null>;
  mapLoaded: boolean;
  geoLevel: GeoLevel;
  selectedGeography: SelectedGeography | null;
  geoDataRef: MutableRefObject<FeatureCollection | null>;
  searchNavigatedRef: MutableRefObject<number>;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useSelectedGeoCinematic({
  mapRef,
  mapLoaded,
  geoLevel,
  selectedGeography,
  geoDataRef,
  searchNavigatedRef,
}: UseSelectedGeoCinematicOptions): void {
  useEffect(() => {
    // KILL SWITCH: default off → no layers, no camera change, behaves as today.
    if (!isCinematicZoomEnabled()) return;

    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Deselect → restore today's view (helpers are no-ops if layers absent).
    if (!selectedGeography) {
      fadeSatellite(map, false);
      setChoroplethDimmed(map, false);
      clearSelectedFeature(map);
      disable3D(map);
      return;
    }

    const feature = findFeatureById(geoDataRef.current, selectedGeography.id);
    const geometry = feature?.geometry;
    if (
      !geometry ||
      (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")
    ) {
      return; // panel still opens; we just don't animate without a polygon
    }
    const bbox = getGeometryBbox(geometry);
    if (!bbox) return;

    const config = getCinematicConfig(geoLevel);
    const reduced = prefersReducedMotion();

    ensureCinematicLayers(map);
    setChoroplethDimmed(map, true);
    fadeSatellite(map, true);
    setSelectedFeature(
      map,
      feature,
      buildSpotlightMask(geometry as Polygon | MultiPolygon),
    );
    if (config.enable3D && !reduced) enable3D(map);
    else disable3D(map);

    // Backstop so an incidental geoLevel-change fly can't fight this one.
    searchNavigatedRef.current = Date.now();

    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      {
        padding: config.padding,
        pitch: reduced ? 0 : config.pitch,
        duration: reduced ? 0 : CINEMATIC.FLY_DURATION,
      },
    );
  }, [
    selectedGeography,
    mapLoaded,
    geoLevel,
    mapRef,
    geoDataRef,
    searchNavigatedRef,
  ]);
}
