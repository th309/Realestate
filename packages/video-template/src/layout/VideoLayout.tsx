import React, { createContext, useContext } from "react";
import { FormatConfig } from "../types";
import { safeZoneFor, safeZonePx } from "../styles/safe-zones";

export interface LayoutConfig {
  format: FormatConfig;
  isVertical: boolean;
  scale: number;
  /**
   * Pixels on each edge covered by platform chrome (TikTok/Reels/Shorts
   * UI on vertical, player controls on horizontal). Text and callouts must
   * stay inside these or they render under the host app's own interface.
   */
  safeZone: { top: number; bottom: number; left: number; right: number };
}

const LayoutContext = createContext<LayoutConfig | null>(null);

export const VideoLayout: React.FC<{
  config: FormatConfig;
  children: React.ReactNode;
}> = ({ config, children }) => {
  const isVertical = config.height > config.width;
  const scale = config.width / 1080;
  const safeZone = safeZonePx(
    safeZoneFor(isVertical),
    config.width,
    config.height,
  );
  return (
    <LayoutContext.Provider
      value={{ format: config, isVertical, scale, safeZone }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayoutContext = (): LayoutConfig => {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayoutContext must be inside VideoLayout");
  return ctx;
};
