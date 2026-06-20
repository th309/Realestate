"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { DEFAULT_MAP_VIEW } from "../types";
import { installMapboxAbortSwallow } from "../utils/mapbox-abort";

/**
 * Creates and tears down the Mapbox map instance and exposes its refs plus
 * load/error state. The init effect runs once on mount and starts at the
 * shared DEFAULT_MAP_VIEW.
 */
export function useMapInstance() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Swallow Mapbox's benign async AbortErrors for the map's whole lifetime
    // (camera moves, resize, satellite loads, teardown). Shared with MapShowcase.
    const detachAbort = installMapboxAbortSwallow();

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: DEFAULT_MAP_VIEW.center,
      zoom: DEFAULT_MAP_VIEW.zoom,
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
          // Some teardown aborts throw synchronously instead — also benign.
        }
        map.current = null;
      }

      detachAbort();
    };
  }, []);

  return { mapContainer, map, popup, mapLoaded, mapError };
}
