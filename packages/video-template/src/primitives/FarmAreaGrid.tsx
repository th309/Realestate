// packages/video-template/src/primitives/FarmAreaGrid.tsx
// Brand colors hardcoded; Task 2.28 will move them to a shared variant module.
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface FarmAreaGridProps {
  areas: Array<{
    zip: string;
    medianPrice: number;
    turnoverPct: number;
    absenteePct: number;
  }>;
}

export const FarmAreaGrid: React.FC<FarmAreaGridProps> = ({ areas }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 16 * scale,
        padding: 40 * scale,
      }}
    >
      {areas.slice(0, 3).map((a, i) => {
        const appear = spring({
          frame: frame - i * 15,
          fps,
          config: { damping: 12 },
        });
        return (
          <div
            key={a.zip}
            style={{
              opacity: appear,
              transform: `translateY(${(1 - appear) * 40}px)`,
              background: "#E8EAF6",
              borderRadius: 16 * scale,
              padding: 20 * scale,
            }}
          >
            <div
              style={{
                fontFamily: "Roboto Mono",
                fontSize: 24 * scale,
                fontWeight: 700,
                color: "#1A237E",
              }}
            >
              ZIP {a.zip}
            </div>
            <div
              style={{
                display: "flex",
                gap: 16 * scale,
                marginTop: 8 * scale,
                color: "#1A237E",
                fontSize: 16 * scale,
              }}
            >
              <div>
                <strong>${(a.medianPrice / 1000).toFixed(0)}K</strong> median
              </div>
              <div>
                <strong>{a.turnoverPct.toFixed(0)}%</strong> turnover
              </div>
              <div>
                <strong>{a.absenteePct.toFixed(0)}%</strong> absentee
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
