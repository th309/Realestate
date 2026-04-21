import React, { createContext, useContext } from "react";
import { FormatConfig } from "../types";

export interface LayoutConfig {
  format: FormatConfig;
  isVertical: boolean;
  scale: number;
}

const LayoutContext = createContext<LayoutConfig | null>(null);

export const VideoLayout: React.FC<{
  config: FormatConfig;
  children: React.ReactNode;
}> = ({ config, children }) => {
  const isVertical = config.height > config.width;
  const scale = config.width / 1080;
  return (
    <LayoutContext.Provider value={{ format: config, isVertical, scale }}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayoutContext = (): LayoutConfig => {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayoutContext must be inside VideoLayout");
  return ctx;
};
