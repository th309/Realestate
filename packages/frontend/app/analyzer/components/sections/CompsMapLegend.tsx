"use client";

import { piq } from "../primitives/piqTokens";

/**
 * Top-right overlay on the comps map explaining what the colored pins mean.
 * Sized small to stay out of the way of the map content; pointer-events
 * disabled so it doesn't intercept clicks meant for markers behind it.
 */
export function MapLegend() {
  return (
    <div
      data-comps-map-legend
      className="absolute top-2 right-2 z-10 inline-flex items-center gap-3 rounded-full"
      style={{
        background: "rgba(255,255,255,0.92)",
        border: `0.5px solid ${piq.border}`,
        padding: "5px 10px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: piq.textMuted,
        boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
        pointerEvents: "none",
      }}
    >
      <LegendDot color={piq.indigo} label="Subject" />
      <LegendDot color={piq.green} label="Sale" />
      <LegendDot color={piq.amber} label="Rental" />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: color,
          border: "1.5px solid #FFFFFF",
          boxShadow: "0 1px 2px rgba(15,23,42,0.15)",
        }}
      />
      <span>{label}</span>
    </span>
  );
}
