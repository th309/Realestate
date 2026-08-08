"use client";

import type { ReactNode } from "react";
import { MobileInputSheet } from "./MobileInputSheet";
import { CustomizeThresholdsDrawer } from "../CustomizeThresholdsDrawer/CustomizeThresholdsDrawer";
import type { Strategy } from "@propertyiq/analyzer-core";
import type { AnalyzerChrome } from "../../lib/use-analyzer-chrome";

interface Props {
  chrome: AnalyzerChrome;
  /** Strategy whose thresholds the drawer edits. */
  strategy: Strategy;
  /**
   * The input panel, hosted by the mobile sheet. Named rather than taken as
   * `children`: this is not a generic slot, and the sheet is only one of the
   * two overlays here — `children` read as "anything, anywhere in this".
   */
  inputPanel: ReactNode;
}

/**
 * The two overlay layers that sit outside the analyzer's page grid, grouped
 * because they share one owner (`useAnalyzerChrome`) and nothing else on the
 * page reads their state.
 */
export function AnalyzerOverlays({ chrome, strategy, inputPanel }: Props) {
  return (
    <>
      <MobileInputSheet
        open={chrome.inputsOpenMobile}
        onClose={chrome.closeInputs}
      >
        {inputPanel}
      </MobileInputSheet>

      <CustomizeThresholdsDrawer
        open={chrome.drawerOpen}
        onClose={chrome.closeDrawer}
        strategy={strategy}
        initialTab={chrome.drawerTab}
      />
    </>
  );
}
