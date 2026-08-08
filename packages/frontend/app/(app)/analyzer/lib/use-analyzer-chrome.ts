"use client";

import { useState } from "react";
import { useMobileInputFocus } from "./use-mobile-input-focus";
import type { ThresholdsTabId } from "../components/CustomizeThresholdsDrawer/useDrawerState";

/**
 * Which analyzer overlay is open: the mobile input sheet and the customize
 * drawer (with the tab it should land on).
 *
 * Both are pure disclosure state with no bearing on the deal itself, so they
 * live here rather than in `AnalyzerClient` — see AnalyzerOverlays, which
 * renders the pair. Focus management on sheet-open stays coupled to the flag
 * that drives it (`useMobileInputFocus`).
 */
export function useAnalyzerChrome() {
  const [inputsOpenMobile, setInputsOpenMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<ThresholdsTabId>("thresholds");

  useMobileInputFocus(inputsOpenMobile);

  return {
    inputsOpenMobile,
    /** Single entry point for property input on mobile. */
    openInputs: () => setInputsOpenMobile(true),
    closeInputs: () => setInputsOpenMobile(false),
    drawerOpen,
    drawerTab,
    openDrawer: (tab: ThresholdsTabId) => {
      setDrawerTab(tab);
      setDrawerOpen(true);
    },
    closeDrawer: () => setDrawerOpen(false),
  };
}

export type AnalyzerChrome = ReturnType<typeof useAnalyzerChrome>;
