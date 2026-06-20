"use client";

import { useEffect } from "react";
import type mapboxgl from "mapbox-gl";
import type { GeoLevel } from "../types";
import { STATE_CENTERS, DEFAULT_MAP_VIEW } from "../types";
import type { MapContextMenuState } from "./useMapSelection";

interface UseMapCameraOptions {
  mapRef: React.RefObject<mapboxgl.Map | null>;
  mapLoaded: boolean;
  geoLevel: GeoLevel;
  selectedState: string;
  /** Timestamp ref set by search/URL navigation so we don't fight a recent flyTo. */
  searchNavigatedRef: React.MutableRefObject<number>;
  setContextMenu: React.Dispatch<
    React.SetStateAction<MapContextMenuState | null>
  >;
}

/**
 * Drives the map camera in response to geo-level / state-filter changes, and
 * closes the right-click context menu when the map starts moving. Camera
 * adjustments are skipped briefly after a search/URL navigation positioned the
 * map (tracked via a timestamp ref so the guard survives Strict Mode remounts).
 */
export function useMapCamera({
  mapRef,
  mapLoaded,
  geoLevel,
  selectedState,
  searchNavigatedRef,
  setContextMenu,
}: UseMapCameraOptions) {
  // Close context menu on map move/zoom
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const close = () => setContextMenu(null);
    mapRef.current.on("movestart", close);
    return () => {
      mapRef.current?.off("movestart", close);
    };
  }, [mapLoaded, mapRef, setContextMenu]);

  // Adjust zoom for different geo levels (skip if search or URL already handled navigation)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Skip if search or URL navigation recently positioned the map.
    // Uses a timestamp (not a consumed boolean) so the guard survives
    // React Strict Mode's double-invocation (mount → unmount → remount).
    if (
      searchNavigatedRef.current > 0 &&
      Date.now() - searchNavigatedRef.current < 3000
    ) {
      return;
    }

    // City, ZIP, and Tract levels zoom to the selected state
    const requiresState = ["city", "zip", "tract"].includes(geoLevel);
    if (requiresState && selectedState && STATE_CENTERS[selectedState]) {
      const center = STATE_CENTERS[selectedState];
      mapRef.current.flyTo({
        center: [center.lng, center.lat],
        zoom: center.zoom,
        duration: 800,
      });
      return;
    }

    // Default country view (single source: DEFAULT_MAP_VIEW).
    mapRef.current.flyTo({
      center: DEFAULT_MAP_VIEW.center,
      zoom: DEFAULT_MAP_VIEW.zoom,
      duration: 500,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoLevel, selectedState]);
}
