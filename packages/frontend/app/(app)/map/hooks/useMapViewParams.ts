"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type {
  GeoLevel,
  ForecastHorizon,
  RentIndexType,
  RenterDemandType,
  ViewMode,
} from "../types";
import {
  getMetricCategories,
  isMetricSupportedForGeo,
  getMetricConfig,
} from "../config";

interface UseMapViewParamsOptions {
  /** Current view mode — drives which metric categories are shown. */
  viewMode: ViewMode;
  /** Entitlements gating check — falls back off a metric that becomes gated. */
  isMetricGated: (metricId: string) => boolean;
}

/**
 * Owns the core map view parameters (geo level, metric, state filter, and the
 * forecast/rent/renter sub-selectors), initialised from URL params so the
 * browser back-button restores a previous view, and kept in sync to the URL via
 * replaceState. Also owns the two compatibility effects: falling back off a
 * gated metric, and auto-switching geo level when a metric doesn't support it.
 *
 * `handleGeoLevelChange` is intentionally NOT here — it also clears the right
 * panel/selection state, so the page composes it from `setGeoLevel`/
 * `setSelectedState`.
 */
export function useMapViewParams({
  viewMode,
  isMetricGated,
}: UseMapViewParamsOptions) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInitialRender = useRef(true);

  // Core state — initialized from URL params so browser back-button restores previous view
  const [geoLevel, setGeoLevel] = useState<GeoLevel>(() => {
    return (searchParams.get("level") as GeoLevel) || "state";
  });
  const [selectedState, setSelectedState] = useState<string>(() => {
    return searchParams.get("st") || "";
  });
  const [selectedMetric, setSelectedMetric] = useState(() => {
    return searchParams.get("metric") || "home_value";
  });
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>(
    () => {
      return (searchParams.get("fh") as ForecastHorizon) || "12m";
    },
  );
  const [rentIndexType, setRentIndexType] = useState<RentIndexType>(() => {
    return (searchParams.get("ri") as RentIndexType) || "all";
  });
  const [renterDemandType, setRenterDemandType] = useState<RenterDemandType>(
    () => {
      return (searchParams.get("rd") as RenterDemandType) || "all";
    },
  );

  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    "popular",
  ]);

  // Sync core state to URL so the browser back button restores previous view.
  // Uses replaceState to update the current history entry without creating new ones.
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (geoLevel !== "state") params.set("level", geoLevel);
    if (selectedMetric !== "home_value") params.set("metric", selectedMetric);
    if (selectedState) params.set("st", selectedState);
    if (forecastHorizon !== "12m") params.set("fh", forecastHorizon);
    if (rentIndexType !== "all") params.set("ri", rentIndexType);
    if (renterDemandType !== "all") params.set("rd", renterDemandType);
    const paramStr = params.toString();
    const newUrl = paramStr ? `${pathname}?${paramStr}` : pathname;
    window.history.replaceState(null, "", newUrl);
  }, [
    geoLevel,
    selectedMetric,
    selectedState,
    forecastHorizon,
    rentIndexType,
    renterDemandType,
    pathname,
  ]);

  // Compute metric categories based on view mode
  const metricCategories = useMemo(
    () => getMetricCategories(viewMode),
    [viewMode],
  );

  // Fallback to home_value if selected metric becomes gated (e.g., subscription expired)
  useEffect(() => {
    if (isMetricGated(selectedMetric)) {
      setSelectedMetric("home_value");
    }
  }, [selectedMetric, isMetricGated]);

  // Auto-switch geo level when metric doesn't support current level
  // Uses central config as single source of truth for metric/geo compatibility
  useEffect(() => {
    // Check if current geoLevel is supported for the selected metric
    if (!isMetricSupportedForGeo(selectedMetric, geoLevel)) {
      // Get the first supported geo level from the metric's config
      const config = getMetricConfig(selectedMetric);
      const supportedGeos = config?.supportedGeos;
      if (supportedGeos && supportedGeos.length > 0) {
        // Auto-switch to the first supported geo (usually the broadest available)
        setGeoLevel(supportedGeos[0] as GeoLevel);
      }
    }
  }, [selectedMetric, geoLevel]);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  return {
    geoLevel,
    setGeoLevel,
    selectedState,
    setSelectedState,
    selectedMetric,
    setSelectedMetric,
    forecastHorizon,
    setForecastHorizon,
    rentIndexType,
    setRentIndexType,
    renterDemandType,
    setRenterDemandType,
    expandedCategories,
    toggleCategory,
    metricCategories,
  };
}
