/**
 * Mapbox GL expression builders for formatting metric values on map labels.
 * Extracted from useMapLayers to keep the hook focused on orchestration.
 */
import type { MetricFormat } from "./metricUtils";

/** Mapbox expression type */
type MapboxExpression = any;

/**
 * Build a Mapbox format expression for displaying a metric value on a label.
 * Returns a Mapbox expression that reads 'value' from feature properties
 * and formats it based on the metric format type.
 */
export function buildValueFormatExpression(
  metricFormat: MetricFormat,
): MapboxExpression {
  switch (metricFormat) {
    case "percent":
      return [
        "concat",
        ["case", [">", ["get", "value"], 0], "+", ""],
        [
          "number-format",
          ["get", "value"],
          { "min-fraction-digits": 1, "max-fraction-digits": 1 },
        ],
        "%",
      ];

    case "percent_abs":
      return [
        "concat",
        [
          "number-format",
          ["get", "value"],
          { "min-fraction-digits": 1, "max-fraction-digits": 1 },
        ],
        "%",
      ];

    case "number":
    case "index":
      return [
        "number-format",
        ["round", ["get", "value"]],
        { "min-fraction-digits": 0, "max-fraction-digits": 0 },
      ];

    case "days":
      return [
        "concat",
        [
          "number-format",
          ["round", ["get", "value"]],
          { "min-fraction-digits": 0, "max-fraction-digits": 0 },
        ],
        " days",
      ];

    case "currency":
    default:
      return [
        "concat",
        "$",
        [
          "number-format",
          ["round", ["get", "value"]],
          { "min-fraction-digits": 0, "max-fraction-digits": 0 },
        ],
      ];
  }
}

/**
 * Format a metric value as a compact string for callout labels.
 * Used by HTML Marker callouts (not Mapbox expressions).
 */
export function formatCompactValue(
  value: number,
  metricFormat: MetricFormat,
): string {
  switch (metricFormat) {
    case "percent":
      return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
    case "percent_abs":
      return `${value.toFixed(1)}%`;
    case "number":
    case "index":
      return Math.round(value).toLocaleString();
    case "days":
      return `${Math.round(value).toLocaleString()} days`;
    case "currency":
    default:
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
      return `$${Math.round(value).toLocaleString()}`;
  }
}
