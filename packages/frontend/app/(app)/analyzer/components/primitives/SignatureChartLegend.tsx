"use client";

import { piq } from "./piqTokens";
import {
  compactValue,
  type DataPoint,
  type HeadlineFormat,
  type SeriesSpec,
} from "./SignatureChartHelpers";

interface SignatureChartLegendProps {
  series: SeriesSpec[];
  activePoint: DataPoint | undefined;
  format: HeadlineFormat;
}

function readValue(point: DataPoint | undefined, key: string): number {
  const v = point?.[key];
  return typeof v === "number" ? v : Number.NaN;
}

/**
 * Multi-series legend: a color dot, series label, and the value at the active
 * (hovered, else last) data point for every series. The chip values stay in
 * sync with the chart's inline scrub labels because both call `compactValue`.
 */
export function SignatureChartLegend({
  series,
  activePoint,
  format,
}: SignatureChartLegendProps) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2" data-signature-legend>
      {series.map((s) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: s.color,
              flexShrink: 0,
            }}
          />
          <span
            style={{ fontSize: "12px", color: piq.textMuted, fontWeight: 500 }}
          >
            {s.label}
          </span>
          <span
            style={{
              fontSize: "13px",
              color: piq.textPrimary,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {compactValue(readValue(activePoint, s.key), format)}
          </span>
        </div>
      ))}
    </div>
  );
}
