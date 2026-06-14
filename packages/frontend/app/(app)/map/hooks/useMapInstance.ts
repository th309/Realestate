"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { GeoLevel } from "../types";
import { GEO_ZOOM_LEVELS } from "../types";

/**
 * Creates and tears down the Mapbox map instance and exposes its refs plus
 * load/error state. The init effect runs once on mount; `initialGeoLevel` is
 * read at mount time only (for the starting zoom), matching the original
 * empty-dependency effect.
 */
export function useMapInstance(initialGeoLevel: GeoLevel) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Keep the latest geoLevel for the mount-only init effect without retriggering it.
  const initialGeoLevelRef = useRef(initialGeoLevel);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-96, 37.8],
      zoom: GEO_ZOOM_LEVELS[initialGeoLevelRef.current],
      projection: "mercator",
    });

    map.current.on("load", () => setMapLoaded(true));
    map.current.on(
      "error",
      (
        e: mapboxgl.ErrorEvent & {
          error?: { message?: string; status?: number };
        },
      ) => {
        const msg = e.error?.message || "Unknown map error";
        // Tile/source errors are transient — only set fatal error if the map never loaded
        if (!map.current?.loaded()) {
          console.error("[Map] fatal load error:", msg);
          setMapError("Map failed to load");
        } else {
          console.warn("[Map] non-fatal error:", msg);
        }
      },
    );

    // Resize map when container dimensions change (handles client-side
    // navigation where flex layout settles after the map initializes)
    const ro = new ResizeObserver(() => map.current?.resize());
    ro.observe(mapContainer.current);

    return () => {
      ro.disconnect();
      if (map.current) {
        try {
          map.current.remove();
        } catch {
          // map.remove() aborts in-flight tile/style requests during teardown.
          // When the map is torn down mid-initialization (dev StrictMode /
          // Fast Refresh remounts), that abort can throw "signal is aborted
          // without reason". Teardown errors are benign — swallow them.
        }
        map.current = null;
      }
    };
  }, []);

  return { mapContainer, map, popup, mapLoaded, mapError };
}
