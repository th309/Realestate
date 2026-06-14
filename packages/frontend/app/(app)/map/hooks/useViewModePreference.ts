"use client";

import { useCallback, useEffect, useState } from "react";
import type { ViewMode } from "../types";

const VIEW_MODE_STORAGE_KEY = "propertyiq-view-mode";

/**
 * Owns the homebuyer/investor view-mode toggle, hydrating the initial value
 * from localStorage on mount and persisting every change.
 */
export function useViewModePreference() {
  const [viewMode, setViewMode] = useState<ViewMode>("homebuyer");

  // Load view mode from localStorage on mount
  useEffect(() => {
    const savedViewMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (savedViewMode === "homebuyer" || savedViewMode === "investor") {
      setViewMode(savedViewMode);
    }
  }, []);

  // Handler to update view mode and persist to localStorage
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }, []);

  return { viewMode, handleViewModeChange };
}
