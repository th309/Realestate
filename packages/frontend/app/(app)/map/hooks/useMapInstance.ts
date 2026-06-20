"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { DEFAULT_MAP_VIEW } from "../types";

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
      if (!map.current) return;

      // map.remove() aborts in-flight tile/style/worker requests. Those aborts
      // reject ASYNCHRONOUSLY, so the synchronous try/catch below never sees
      // them — they escape as an unhandled "signal is aborted without reason"
      // (AbortError) rejection. React StrictMode / Fast Refresh trigger this
      // constantly by remounting the map mid-initialization. Swallow that
      // benign teardown abort where it actually lands: unhandledrejection.
      const swallowTeardownAbort = (event: PromiseRejectionEvent) => {
        const reason = event.reason as { name?: string } | undefined;
        if (reason?.name === "AbortError") event.preventDefault();
      };
      window.addEventListener("unhandledrejection", swallowTeardownAbort);

      try {
        map.current.remove();
      } catch {
        // Some teardown aborts throw synchronously instead — also benign.
      }
      map.current = null;

      // Keep the guard up through the microtask flush where the abort rejects,
      // then detach so we never suppress unrelated AbortErrors.
      setTimeout(
        () =>
          window.removeEventListener(
            "unhandledrejection",
            swallowTeardownAbort,
          ),
        0,
      );
    };
  }, []);

  return { mapContainer, map, popup, mapLoaded, mapError };
}
