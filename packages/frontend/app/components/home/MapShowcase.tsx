"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type mapboxgl from "mapbox-gl";
import { useInView } from "./hooks/useInView";
import { useMapData, useMapLayers } from "@/app/map/hooks";
import { Legend, GeoLevelPills } from "@/app/map/components";
import { MAPBOX_ACCESS_TOKEN } from "@/app/map/config";
import { GEO_ZOOM_LEVELS, STATE_CENTERS } from "@/app/map/types";
import type { GeoLevel, SelectedGeography } from "@/app/map/types";

/**
 * Live interactive map rendered directly on the homepage.
 * Uses the same hooks as the full map page — no iframe.
 */
export function MapShowcase() {
  const [sectionRef, inView] = useInView();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [geoLevel, setGeoLevel] = useState<GeoLevel>("state");
  const [selectedState, setSelectedState] = useState("");
  const selectedMetric = "home_value";

  // Data hooks — same ones the full map page uses
  const { mapData, dataLoading, fetchMapData } = useMapData();

  const handleFeatureClick = useCallback(
    (_geo: SelectedGeography | null) => {},
    [],
  );

  useMapLayers({
    map,
    popup,
    geoLevel,
    selectedState,
    selectedMetric,
    forecastHorizon: "12m",
    mapData,
    mapLoaded,
    dataLoading,
    highlightedFeature: null,
    onFeatureClick: handleFeatureClick,
  });

  // Fetch data — city/zip/tract require a state selection
  useEffect(() => {
    const requiresState = ["city", "zip", "tract"].includes(geoLevel);
    if (requiresState) {
      if (selectedState) {
        fetchMapData(geoLevel, selectedState, selectedMetric, "12m");
      }
    } else {
      fetchMapData(geoLevel, undefined, selectedMetric, "12m");
    }
  }, [geoLevel, selectedState, fetchMapData]);

  // Initialize map — only when section scrolls into view.
  // mapbox-gl is dynamically imported to avoid bundling ~700KB on initial load.
  const mapInitRef = useRef(false);
  useEffect(() => {
    if (!inView || mapInitRef.current || !mapContainer.current) return;
    mapInitRef.current = true;

    let ro: ResizeObserver | undefined;
    const containerEl = mapContainer.current;

    import("mapbox-gl").then((mapboxModule) => {
      // Also load the CSS dynamically alongside the JS
      // @ts-expect-error -- CSS module has no type declarations
      import("mapbox-gl/dist/mapbox-gl.css");

      const mb = mapboxModule.default;
      mb.accessToken = MAPBOX_ACCESS_TOKEN;

      map.current = new mb.Map({
        container: containerEl,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-95.5, 38],
        zoom: 3.5,
        projection: "mercator",
        interactive: true,
        attributionControl: false,
      });

      map.current.addControl(
        new mb.NavigationControl({ showCompass: false }),
        "top-right",
      );

      map.current.on("load", () => setMapLoaded(true));

      ro = new ResizeObserver(() => map.current?.resize());
      ro.observe(containerEl);
    });

    return () => {
      ro?.disconnect();
    };
  }, [inView]);

  // Fly to correct zoom when geo level or selected state changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const requiresState = ["city", "zip", "tract"].includes(geoLevel);
    if (requiresState && selectedState && STATE_CENTERS[selectedState]) {
      const center = STATE_CENTERS[selectedState];
      // Reduce zoom by 1 vs full map page — the homepage container is smaller
      // so the same zoom level would crop the state
      map.current.flyTo({
        center: [center.lng, center.lat],
        zoom: center.zoom - 1,
        duration: 800,
      });
      return;
    }

    map.current.flyTo({
      center: [-95.5, 38],
      zoom: 3.5,
      duration: 600,
    });
  }, [geoLevel, selectedState, mapLoaded]);

  const handleGeoLevelChange = useCallback((level: GeoLevel) => {
    setGeoLevel(level);
    if (!["city", "zip", "tract"].includes(level)) {
      setSelectedState("");
    }
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-10 lg:py-14 px-6"
      aria-labelledby="map-showcase-heading"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div
          className="text-center max-w-2xl mx-auto mb-8"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          <span className="text-xs font-semibold text-[#C5CAE9] uppercase tracking-[0.15em] mb-3 block">
            Explore the Data
          </span>
          <h2
            id="map-showcase-heading"
            className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight mb-4 font-[family-name:var(--font-source-serif)]"
          >
            Every market, visualized
          </h2>
          <p className="text-base text-[#C5CAE9] leading-relaxed">
            Explore home values, rents, appreciation, and 40+ metrics across
            every metro, county, and ZIP code in America.
          </p>
        </div>

        {/* Map container */}
        <div
          className="relative mx-auto rounded-xl overflow-hidden shadow-xl border border-white/10"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "scale(1)" : "scale(0.98)",
            transition: "opacity 0.8s ease, transform 0.8s ease",
            transitionDelay: "0.15s",
          }}
        >
          {/* Geo level pills overlay */}
          <div className="absolute top-3 left-3 z-10">
            <GeoLevelPills
              geoLevel={geoLevel}
              selectedMetric={selectedMetric}
              selectedState={selectedState}
              onGeoLevelChange={handleGeoLevelChange}
              onStateChange={setSelectedState}
              excludeLevels={["city"]}
            />
          </div>

          {/* Map — explicit dimensions prevent CLS before tiles load */}
          <div
            ref={mapContainer}
            className="w-full"
            style={{ height: "min(60vw, 560px)", minHeight: "320px" }}
          />

          {/* Legend */}
          <Legend
            selectedMetric={selectedMetric}
            forecastHorizon="12m"
            geoLevel={geoLevel}
            mapData={mapData}
          />
        </div>

        {/* CTA */}
        <div
          className="text-center mt-6"
          style={{
            opacity: inView ? 1 : 0,
            transition: "opacity 0.6s ease",
            transitionDelay: "0.3s",
          }}
        >
          <a
            href="/map"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#C5CAE9] hover:text-white transition-colors"
          >
            Open full map experience →
          </a>
        </div>
      </div>
    </section>
  );
}
