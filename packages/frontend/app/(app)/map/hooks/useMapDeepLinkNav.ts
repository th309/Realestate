"use client";

import { useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";
import { useSearchParams } from "next/navigation";
import type { GeoLevel, SearchResult, SelectedGeography } from "../types";
import { fetchGeographySearch } from "@/lib/data";
import { MAPBOX_ACCESS_TOKEN } from "../config";

interface UseMapDeepLinkNavOptions {
  mapRef: React.RefObject<mapboxgl.Map | null>;
  mapLoaded: boolean;
  onFeatureClick: (geography: SelectedGeography | null) => void;
  onSelectSearchResult: (result: SearchResult) => void;
}

/**
 * Handles deep-link navigation (e.g. /map?geo=metro&id=31080). Navigation
 * params are captured into a ref DURING render — before any effect runs — so
 * they survive the URL-sync effect's replaceState (which strips unknown params,
 * especially under React Strict Mode's double-invocation). Once the map has
 * loaded, the params are resolved to centroid coordinates and the right panel +
 * camera are positioned, then consumed.
 */
export function useMapDeepLinkNav({
  mapRef,
  mapLoaded,
  onFeatureClick,
  onSelectSearchResult,
}: UseMapDeepLinkNavOptions) {
  const searchParams = useSearchParams();

  const pendingNavRef = useRef<
    | {
        geo: string;
        id: string;
        name: string;
        lat?: string;
        lng?: string;
        state?: string;
      }
    | null
    | undefined
  >(undefined);
  if (pendingNavRef.current === undefined) {
    const geo = searchParams.get("geo");
    const id = searchParams.get("id") || searchParams.get("region");
    if (geo && id) {
      pendingNavRef.current = {
        geo,
        id,
        name: searchParams.get("name") || id,
        lat: searchParams.get("lat") || undefined,
        lng: searchParams.get("lng") || undefined,
        state: searchParams.get("state") || undefined,
      };
    } else {
      pendingNavRef.current = null;
    }
  }

  useEffect(() => {
    if (!mapLoaded) return;

    const nav = pendingNavRef.current;
    if (!nav) return;

    // Consume — prevent re-processing on subsequent renders
    pendingNavRef.current = null;

    const navigateToGeography = async () => {
      // Resolve center coordinates: prefer URL params → backend → Mapbox geocode.
      // We await all lookups here so handleSelectSearchResult always gets a real
      // `center` and never falls through to its fire-and-forget geocode branch.
      let center: [number, number] | undefined;
      if (nav.lat && nav.lng) {
        center = [parseFloat(nav.lng), parseFloat(nav.lat)];
      } else {
        // 1. Try backend geography search (same API the search bar uses)
        try {
          const results = await fetchGeographySearch(nav.name, {
            type: nav.geo,
            limit: 1,
          });
          const hit = results[0];
          if (hit?.longitude != null && hit?.latitude != null) {
            center = [hit.longitude, hit.latitude];
          }
        } catch {
          /* fall through */
        }

        // 2. If backend has no coords (e.g. county centroids not in DB), use Mapbox geocoding
        if (!center && MAPBOX_ACCESS_TOKEN) {
          try {
            const query = encodeURIComponent(nav.name);
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1&country=us`;
            const res = await fetch(url);
            const data = await res.json();
            const feature = data.features?.[0];
            if (feature?.center) {
              center = feature.center as [number, number];
            }
          } catch {
            /* no coords available — onSelectSearchResult will try its own fallback */
          }
        }
      }

      // Open the panel FIRST so the map container reaches its final width
      onFeatureClick({
        id: nav.id,
        name: nav.name,
        geoLevel: nav.geo as GeoLevel,
        value: null,
        stateAbbr: nav.state,
      });

      // Wait one frame for the DOM to reflow, then resize the map canvas
      // to match the now-narrower container before issuing the flyTo.
      await new Promise((r) => requestAnimationFrame(r));
      mapRef.current?.resize();

      onSelectSearchResult({
        id: nav.id,
        name: nav.name,
        type: nav.geo as SearchResult["type"],
        center,
        state: nav.state,
      });
    };

    navigateToGeography();
  }, [mapLoaded, onSelectSearchResult, onFeatureClick, mapRef]);
}
