import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

interface OutroSummaryEntry {
  rank: number;
  region_id?: string;
  region_name: string;
  state: string;
  value_formatted: string;
}

interface OutroSummaryProps {
  /** Markets in countdown order (last entry = #1). */
  markets: ReadonlyArray<OutroSummaryEntry>;
  accent: string;
  themeLabel: string;
}

/**
 * Final all-ranks recap shown during the outro voice-over. Reverses the
 * countdown so the audience sees the leaderboard in best-to-worst order
 * with #1 at the top — the natural mental model for the recap.
 *
 * Sized to fill the full 1080×1920 frame minus the persistent CornerBug
 * region. Each row gets ~150px of vertical space so the recap reads as a
 * confident editorial table, not a cramped tooltip. Stagger-fades each row
 * in sequence (~80ms apart) so the leaderboard feels assembled, not
 * dropped.
 */
export const OutroSummary: React.FC<OutroSummaryProps> = ({
  markets,
  accent,
  themeLabel,
}) => {
  const frame = useCurrentFrame();
  const headerOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const summary = [...markets].reverse();
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        // Top padding clears the CornerBug region; bottom padding clears the
        // closing brand card region so the recap doesn't feel buried.
        padding: "240px 80px 80px 80px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 20,
          marginBottom: 50,
          opacity: headerOpacity,
        }}
      >
        <div
          style={{
            fontFamily: "'Roboto Mono', monospace",
            fontWeight: 700,
            fontSize: 56,
            letterSpacing: "0.28em",
            color: accent,
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          {themeLabel}
        </div>
        <div
          style={{
            height: 3,
            width: "100%",
            backgroundColor: "#5C6BC0",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "space-between",
        }}
      >
        {summary.map((m, i) => {
          const rowDelay = 14 + i * 2; // ~67ms stagger at 30fps
          const rowOpacity = interpolate(
            frame,
            [rowDelay, rowDelay + 8],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          );
          const rowRise = interpolate(
            frame,
            [rowDelay, rowDelay + 10],
            [16, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          );
          return (
            <div
              key={m.region_id ?? `${m.rank}-${m.region_name}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 32,
                color: "#FFFFFF",
                borderBottom: "1px solid rgba(92, 107, 192, 0.32)",
                paddingBottom: 14,
                opacity: rowOpacity,
                transform: `translateY(${rowRise}px)`,
              }}
            >
              <span
                style={{
                  fontFamily: "'Roboto Mono', monospace",
                  fontWeight: 800,
                  fontSize: 88,
                  lineHeight: 1,
                  color: accent,
                  width: 130,
                  textAlign: "right",
                  letterSpacing: "-0.04em",
                }}
              >
                {m.rank}
              </span>
              <span
                style={{
                  flex: 1,
                  fontFamily: "'Roboto', sans-serif",
                  fontWeight: 800,
                  fontSize: 64,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {m.region_name}
                <span
                  style={{
                    fontFamily: "'Roboto Mono', monospace",
                    fontWeight: 500,
                    fontSize: 40,
                    color: "#9FA8DA",
                    marginLeft: 18,
                  }}
                >
                  {m.state}
                </span>
              </span>
              <span
                style={{
                  fontFamily: "'Roboto Mono', monospace",
                  fontWeight: 700,
                  fontSize: 80,
                  lineHeight: 1,
                  color: "#FFFFFF",
                  letterSpacing: "-0.02em",
                  textAlign: "right",
                  minWidth: 180,
                }}
              >
                {m.value_formatted}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
