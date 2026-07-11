"use client";

/**
 * Resolves which momentum color-stop set to use. The site's chrome flips via
 * CSS `prefers-color-scheme`, but the map's DATA colors are computed in JS —
 * this hook mirrors the same media query so dots and legend select the
 * dark-validated stop set instead of naively reusing the light one.
 * SSR-safe: defaults to "light" until the effect runs.
 */

import { useEffect, useState } from "react";
import type { MomentumColorMode } from "./momentum-map-colors";

export function useMomentumColorMode(): MomentumColorMode {
  const [mode, setMode] = useState<MomentumColorMode>("light");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setMode(mq.matches ? "dark" : "light");
    const onChange = (event: MediaQueryListEvent) =>
      setMode(event.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return mode;
}
