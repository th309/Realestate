"use client";

import { useCallback } from "react";
import type {
  ForecastHorizon,
  GeoLevel,
  RentIndexType,
  RenterDemandType,
  SelectedGeography,
  ViewMode,
} from "../types";
import { trackEvent } from "@/lib/analytics/tracker";

interface UseTrackedMapFiltersParams {
  geoLevel: GeoLevel;
  setGeoLevel: (level: GeoLevel) => void;
  setSelectedState: (state: string) => void;
  setSelectedMetric: (id: string) => void;
  setForecastHorizon: (horizon: ForecastHorizon) => void;
  setRentIndexType: (type: RentIndexType) => void;
  setRenterDemandType: (type: RenterDemandType) => void;
  handleViewModeChange: (mode: ViewMode) => void;
  setSelectedGeography: (geography: SelectedGeography | null) => void;
  setRightPanelOpen: (open: boolean) => void;
}

/**
 * Every map filter control, wrapped with `feature.map_filter` tracking.
 * Before this hook existed, only the metric picker fired an event (inline in
 * MapPageInner) — geo level, state, forecast horizon, rent-index type,
 * renter-demand type and view mode all passed their raw setState setter
 * straight through as a prop, invisible to analytics. Consolidated into one
 * hook (rather than staying inline in MapPageInner) to keep that file under
 * the 400-line component limit.
 */
export function useTrackedMapFilters({
  geoLevel,
  setGeoLevel,
  setSelectedState,
  setSelectedMetric,
  setForecastHorizon,
  setRentIndexType,
  setRenterDemandType,
  handleViewModeChange,
  setSelectedGeography,
  setRightPanelOpen,
}: UseTrackedMapFiltersParams) {
  // Also clears the state filter for geo levels that don't need it (only
  // city, zip, tract do), and closes any open selection — the level change
  // invalidates whatever was selected under the old level.
  const handleGeoLevelChange = useCallback(
    (level: GeoLevel) => {
      trackEvent("feature.map_filter", {
        filter_type: "geo_level",
        value: level,
      });
      setGeoLevel(level);
      setSelectedGeography(null);
      setRightPanelOpen(false);
      if (!["city", "zip", "tract"].includes(level)) {
        setSelectedState("");
      }
    },
    [setGeoLevel, setSelectedState, setSelectedGeography, setRightPanelOpen],
  );

  const handleSelectMetric = useCallback(
    (id: string) => {
      trackEvent("feature.map_filter", {
        filter_type: "metric",
        metric_id: id,
        geo_level: geoLevel,
      });
      setSelectedMetric(id);
    },
    [geoLevel, setSelectedMetric],
  );

  const handleStateChange = useCallback(
    (state: string) => {
      trackEvent("feature.map_filter", {
        filter_type: "state",
        value: state,
        geo_level: geoLevel,
      });
      setSelectedState(state);
    },
    [geoLevel, setSelectedState],
  );

  const handleForecastHorizonChange = useCallback(
    (horizon: ForecastHorizon) => {
      trackEvent("feature.map_filter", {
        filter_type: "forecast_horizon",
        value: horizon,
      });
      setForecastHorizon(horizon);
    },
    [setForecastHorizon],
  );

  const handleRentIndexTypeChange = useCallback(
    (type: RentIndexType) => {
      trackEvent("feature.map_filter", {
        filter_type: "rent_index_type",
        value: type,
      });
      setRentIndexType(type);
    },
    [setRentIndexType],
  );

  const handleRenterDemandTypeChange = useCallback(
    (type: RenterDemandType) => {
      trackEvent("feature.map_filter", {
        filter_type: "renter_demand_type",
        value: type,
      });
      setRenterDemandType(type);
    },
    [setRenterDemandType],
  );

  const handleViewModeChangeTracked = useCallback(
    (mode: ViewMode) => {
      trackEvent("feature.map_filter", {
        filter_type: "view_mode",
        value: mode,
      });
      handleViewModeChange(mode);
    },
    [handleViewModeChange],
  );

  return {
    handleGeoLevelChange,
    handleSelectMetric,
    handleStateChange,
    handleForecastHorizonChange,
    handleRentIndexTypeChange,
    handleRenterDemandTypeChange,
    handleViewModeChangeTracked,
  };
}
