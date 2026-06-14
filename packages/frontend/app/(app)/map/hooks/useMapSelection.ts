"use client";

import { useCallback, useState } from "react";
import type { SelectedGeography } from "../types";
import { trackEvent } from "@/lib/analytics/tracker";

export interface MapContextMenuState {
  geography: SelectedGeography;
  x: number;
  y: number;
}

/**
 * Owns the region-selection and right-panel/context-menu UI state, plus the
 * click and right-click handlers. Selecting a region tracks an analytics event
 * and persists the last geography to localStorage so other pages can pick it up.
 */
export function useMapSelection() {
  const [selectedGeography, setSelectedGeography] =
    useState<SelectedGeography | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<MapContextMenuState | null>(
    null,
  );

  const handleFeatureClick = useCallback(
    (geography: SelectedGeography | null) => {
      if (!geography) {
        setSelectedGeography(null);
        setRightPanelOpen(false);
        return;
      }
      setSelectedGeography(geography);
      if (geography) {
        trackEvent("feature.region_select", {
          region_id: geography.id,
          region_name: geography.name,
          geo_level: geography.geoLevel,
        });
        setRightPanelOpen(true);
        // Persist to localStorage so other pages (graphs, reports) can pick it up
        try {
          localStorage.setItem(
            "propertyiq-last-geography",
            JSON.stringify({
              id: geography.id,
              name: geography.name,
              type: geography.geoLevel,
              state: geography.stateAbbr,
            }),
          );
        } catch {
          /* ignore storage errors */
        }
      }
    },
    [],
  );

  const handleFeatureContextMenu = useCallback((info: MapContextMenuState) => {
    setContextMenu(info);
  }, []);

  return {
    selectedGeography,
    setSelectedGeography,
    rightPanelOpen,
    setRightPanelOpen,
    contextMenu,
    setContextMenu,
    handleFeatureClick,
    handleFeatureContextMenu,
  };
}
