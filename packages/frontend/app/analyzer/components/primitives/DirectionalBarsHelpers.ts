import { useEffect, useRef, useState } from "react";
import { piq } from "./piqTokens";

export type BarType = "income" | "expense" | "result";

export type BarItem = {
  label: string;
  /**
   * Signed value. In waterfall mode, value drives the bar direction (positive
   * bars grow up, negative grow down). In tornado mode, the magnitude
   * determines symmetric bar length on both sides of the center axis.
   */
  value: number;
  /** Waterfall only. `result` bars render as full bars from zero to the running total. */
  type?: BarType;
  tooltip?: string;
};

export type DirectionalColors = {
  positive: string;
  negative: string;
  result: string;
};

export const DEFAULT_COLORS: DirectionalColors = {
  positive: piq.green,
  negative: piq.red,
  result: piq.indigo,
};

export function inferBarType(item: BarItem): BarType {
  if (item.type) return item.type;
  return item.value >= 0 ? "income" : "expense";
}

export function colorForBarType(
  type: BarType,
  colors: DirectionalColors,
): string {
  if (type === "result") return colors.result;
  if (type === "income") return colors.positive;
  return colors.negative;
}

export type BarValueFormat =
  | "currency"
  | "currency-exact"
  | "percent"
  | "ratio"
  | "number";

export function formatBarValue(value: number, format: BarValueFormat): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : value > 0 ? "+" : "";
  if (format === "currency") {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  if (format === "currency-exact") {
    return `${sign}$${Math.round(abs).toLocaleString()}`;
  }
  if (format === "percent") return `${sign}${abs.toFixed(2)}%`;
  if (format === "ratio") return `${sign}${abs.toFixed(2)}`;
  return `${sign}${abs.toLocaleString()}`;
}

export interface WaterfallSegment {
  item: BarItem;
  /** Data-space y at which this bar starts. */
  yStart: number;
  /** Data-space y at which this bar ends (or the running total, for result bars). */
  yEnd: number;
  index: number;
  type: BarType;
}

/**
 * Walk the bar items, accumulating a running total. Non-result bars consume
 * their value; result bars render as the full running total from zero.
 */
export function computeWaterfallSegments(data: BarItem[]): {
  segments: WaterfallSegment[];
  yMin: number;
  yMax: number;
} {
  let running = 0;
  const segments: WaterfallSegment[] = data.map((item, index) => {
    const type = inferBarType(item);
    if (type === "result") {
      return { item, yStart: 0, yEnd: running, index, type };
    }
    const yStart = running;
    running += item.value;
    return { item, yStart, yEnd: running, index, type };
  });
  const allY = segments.flatMap((s) => [s.yStart, s.yEnd]);
  const yMin = Math.min(0, ...allY);
  const yMax = Math.max(0, ...allY);
  return { segments, yMin, yMax };
}

/** ResizeObserver-backed width tracker for responsive SVG containers. */
export function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}
