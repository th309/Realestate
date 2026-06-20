import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Map as MapboxMap, MapEventOf } from "mapbox-gl";
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
  // The exact camera before the cinematic zoom, captured once per selection
  // session and restored on deselect (dynamic — no hardcoded zoom).
  const preCinematicCameraRef = useRef<{
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  } | null>(null);

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
      // Return to the exact camera the map had before the cinematic zoom, so
      // closing the panel doesn't leave the map zoomed in.
      const prev = preCinematicCameraRef.current;
      if (prev) {
        // Sync the canvas to the now-expanded container BEFORE restoring, so the
        // center isn't shifted east by the panel-close resize.
        map.resize();
        map.easeTo({
          center: prev.center,
          zoom: prev.zoom,
          pitch: prev.pitch,
          bearing: prev.bearing,
          duration: 600,
        });
        preCinematicCameraRef.current = null;
      }
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

    // Capture the pre-cinematic camera once per selection session (kept across
    // A→B reselections) so deselect can restore the exact prior view.
    if (preCinematicCameraRef.current === null) {
      const c = map.getCenter();
      preCinematicCameraRef.current = {
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      };
    }

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
    // NOTE: this shares useMapCamera's ~3s suppression window, so a geoLevel
    // change within ~3s of a selection will have its camera fly suppressed.
    searchNavigatedRef.current = Date.now();

    const bounds: [[number, number], [number, number]] = [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ];

    // The right detail panel shrinks the map container (a ResizeObserver resizes
    // the canvas), so the VISIBLE area is the canvas itself — center the geo with
    // symmetric padding. Resize first so fitBounds fits the already-shrunk canvas.
    map.resize();
    const padding = config.padding;

    // Release the tilt + 3D when the USER zooms back out. We react only to
    // user-initiated zoom (scroll/pinch carry `originalEvent`; the cinematic fly
    // and other programmatic moves do not), and only on zoom-OUT (tracked via
    // lastZoom) so zooming further in keeps the tilt.
    let onZoom: ((e: MapEventOf<"zoom">) => void) | null = null;
    if (!reduced && config.pitch > 0) {
      let lastZoom = map.getZoom();
      onZoom = (e) => {
        const z = map.getZoom();
        const zoomingOut = z < lastZoom - 0.01;
        lastZoom = z;
        const originalEvent = (
          e as { originalEvent?: WheelEvent | TouchEvent } | undefined
        )?.originalEvent;
        if (originalEvent && zoomingOut && map.getPitch() > 0) {
          map.easeTo({ pitch: 0, duration: 300 });
          disable3D(map);
        }
      };
      map.on("zoom", onZoom);
    }

    map.fitBounds(bounds, {
      padding,
      pitch: reduced ? 0 : config.pitch,
      duration: reduced ? 0 : CINEMATIC.FLY_DURATION,
    });

    return () => {
      if (onZoom) map.off("zoom", onZoom);
      if (!isCinematicZoomEnabled()) return;
      const m = mapRef.current;
      if (!m) return;
      fadeSatellite(m, false);
      setChoroplethDimmed(m, false);
      clearSelectedFeature(m);
      disable3D(m);
    };
  }, [
    selectedGeography,
    mapLoaded,
    geoLevel,
    mapRef,
    geoDataRef,
    searchNavigatedRef,
  ]);
}
