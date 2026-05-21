"use client";

import { DirectionalBarsWaterfall } from "./DirectionalBarsWaterfall";
import { DirectionalBarsTornado } from "./DirectionalBarsTornado";
import {
  DEFAULT_COLORS,
  type BarItem,
  type BarValueFormat,
  type DirectionalColors,
} from "./DirectionalBarsHelpers";

// Re-export public types for external callers.
export type {
  BarItem,
  BarType,
  BarValueFormat,
  DirectionalColors,
} from "./DirectionalBarsHelpers";

export type DirectionalBarsProps = {
  data: BarItem[];
  layout: "waterfall" | "tornado";
  /** @deprecated Use `format="currency"` instead. */
  currency?: boolean;
  /** Format for end-of-bar labels and tooltip values. Defaults to "currency" when `currency` is true, else "number". */
  format?: BarValueFormat;
  height?: number;
  /** Override default piq palette. All three roles required if provided. */
  color?: DirectionalColors;
  /** Waterfall only — dashed connectors between adjacent bars. Default true. */
  showConnectors?: boolean;
  className?: string;
};

export function DirectionalBars({
  data,
  layout,
  currency = false,
  format,
  height = 280,
  color,
  showConnectors = true,
  className = "",
}: DirectionalBarsProps) {
  const colors = color ?? DEFAULT_COLORS;
  const resolvedFormat: BarValueFormat =
    format ?? (currency ? "currency" : "number");

  return (
    <div
      data-directional-bars
      data-layout={layout}
      data-format={resolvedFormat}
      className={className}
      style={{ width: "100%" }}
    >
      {layout === "waterfall" ? (
        <DirectionalBarsWaterfall
          data={data}
          height={height}
          colors={colors}
          format={resolvedFormat}
          showConnectors={showConnectors}
        />
      ) : (
        <DirectionalBarsTornado
          data={data}
          height={height}
          colors={colors}
          format={resolvedFormat}
        />
      )}
    </div>
  );
}
