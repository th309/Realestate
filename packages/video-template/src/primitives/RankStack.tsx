import React from "react";

interface StackEntry {
  rank: number;
  marketName: string;
  state: string;
  valueFormatted: string;
}

interface RankStackProps {
  /** All ranks already revealed (oldest → newest). The bottom of the stack is the most recent. */
  history: StackEntry[];
  /** Sliding window size — show only the most recent N entries. */
  windowSize: number;
  /** Accent color for the leading rank pill. Matches HeroRow's accent. */
  accent: string;
}

/**
 * Sliding-window leaderboard column docked to the right edge. As each new
 * row reveals on the hero stage, it slides into the bottom of this stack
 * and the oldest in-window entry slides off the top. The stack persists
 * across the full ranking sequence so viewers always see "what we just
 * counted down past," giving the format the leaderboard-feeling without
 * forcing all 10 on screen at once (which would crowd the hero).
 *
 * By design the current row is NOT in the stack — it lives on the hero
 * stage. The stack only holds previously-revealed ranks. When the hero
 * transitions to the next row, the layout shifts the current row INTO
 * the stack at the bottom.
 */
export const RankStack: React.FC<RankStackProps> = ({
  history,
  windowSize,
  accent,
}) => {
  const visible = history.slice(-windowSize);

  return (
    <div
      style={{
        position: "absolute",
        top: 220,
        right: 36,
        bottom: 280,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 14,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      {visible.map((entry, idx) => {
        // Older entries (top of stack) fade and shrink slightly.
        const distanceFromBottom = visible.length - 1 - idx;
        const opacity = Math.max(0.35, 1 - distanceFromBottom * 0.18);
        const scale = 1 - distanceFromBottom * 0.04;
        return (
          <div
            key={entry.rank}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "10px 14px 10px 10px",
              borderRadius: 12,
              backgroundColor: "rgba(26, 35, 126, 0.45)",
              backdropFilter: "blur(6px)",
              borderLeft: `2px solid ${idx === visible.length - 1 ? accent : "#5C6BC0"}`,
              opacity,
              transform: `scale(${scale})`,
              transformOrigin: "right center",
              maxWidth: 260,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                backgroundColor:
                  idx === visible.length - 1 ? accent : "#3949AB",
                color: idx === visible.length - 1 ? "#08081A" : "#FFFFFF",
                fontFamily: "'Roboto Mono', monospace",
                fontWeight: 800,
                fontSize: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {entry.rank}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontFamily: "'Roboto', sans-serif",
                  fontWeight: 700,
                  fontSize: 18,
                  color: "#FFFFFF",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {entry.marketName}
              </div>
              <div
                style={{
                  fontFamily: "'Roboto Mono', monospace",
                  fontWeight: 500,
                  fontSize: 13,
                  color: "#9FA8DA",
                  letterSpacing: "0.08em",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.state} · {entry.valueFormatted}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
