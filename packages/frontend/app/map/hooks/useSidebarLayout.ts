"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Owns the metric sidebar's width and collapsed state, including:
 * - auto-collapse below 1440px / auto-expand above (manual toggle wins until
 *   the next breakpoint crossing)
 * - drag-to-resize between 200px and 500px
 */
export function useSidebarLayout() {
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const sidebarCollapsedManualRef = useRef(false);
  const isResizing = useRef(false);

  // Auto-collapse sidebar on narrow screens (<1440px), auto-expand on wide screens.
  // Manual toggle overrides auto-behavior until the next resize crosses the threshold.
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1440px)");
    // Set initial state based on current viewport
    setSidebarCollapsed(!mql.matches);
    const handleChange = (e: MediaQueryListEvent) => {
      sidebarCollapsedManualRef.current = false;
      setSidebarCollapsed(!e.matches);
    };
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const handleToggleSidebarCollapsed = useCallback(() => {
    sidebarCollapsedManualRef.current = true;
    setSidebarCollapsed((prev) => !prev);
  }, []);

  // Sidebar resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = e.clientX - 80;
      setSidebarWidth(Math.min(Math.max(newWidth, 200), 500));
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return {
    sidebarWidth,
    sidebarCollapsed,
    handleToggleSidebarCollapsed,
    handleMouseDown,
  };
}
