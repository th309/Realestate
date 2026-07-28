// packages/video-template/src/primitives/FarmAreaGrid.tsx
import React from "react";
import { AnimatedEntrance } from "../motion";
import {
  FONTS,
  NUMERIC,
  PALETTE,
  brandBorder,
  brandFill,
} from "../styles/tokens";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface FarmAreaGridProps {
  areas: Array<{
    zip: string;
    medianPrice: number;
    turnoverPct: number;
    absenteePct: number;
  }>;
}

/**
 * Three-up ZIP farm-area cards. Each card enters on the house 4-frame
 * stagger so the grid assembles top-down, and carries the brand card
 * treatment — 8% container tint, 1.75px softened indigo border, rounded-xl.
 */
export const FarmAreaGrid: React.FC<FarmAreaGridProps> = ({ areas }) => {
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
      {areas.slice(0, 3).map((a, i) => (
        // Index is part of the key because the empty-bundle fallback renders
        // three placeholder cards that all carry the same "—" zip.
        <AnimatedEntrance
          key={`${a.zip}-${i}`}
          index={i}
          from="rise"
          distance={40}
        >
          <div
            style={{
              background: brandFill(PALETTE.container),
              border: brandBorder(PALETTE.indigoLight, 0.28),
              borderRadius: 24 * scale,
              padding: 20 * scale,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 24 * scale,
                fontWeight: 700,
                color: PALETTE.indigoLight,
                ...NUMERIC,
              }}
            >
              ZIP {a.zip}
            </div>
            <div
              style={{
                display: "flex",
                gap: 16 * scale,
                marginTop: 8 * scale,
                fontFamily: FONTS.body,
                color: PALETTE.indigoMuted,
                fontSize: 16 * scale,
              }}
            >
              <div>
                <strong
                  style={{
                    fontFamily: FONTS.mono,
                    color: PALETTE.surface,
                    ...NUMERIC,
                  }}
                >
                  ${(a.medianPrice / 1000).toFixed(0)}K
                </strong>{" "}
                median
              </div>
              <div>
                <strong
                  style={{
                    fontFamily: FONTS.mono,
                    color: PALETTE.surface,
                    ...NUMERIC,
                  }}
                >
                  {a.turnoverPct.toFixed(0)}%
                </strong>{" "}
                turnover
              </div>
              <div>
                <strong
                  style={{
                    fontFamily: FONTS.mono,
                    color: PALETTE.surface,
                    ...NUMERIC,
                  }}
                >
                  {a.absenteePct.toFixed(0)}%
                </strong>{" "}
                absentee
              </div>
            </div>
          </div>
        </AnimatedEntrance>
      ))}
    </div>
  );
};
